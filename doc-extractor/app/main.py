import os
import re
import tempfile
import unicodedata
from statistics import median
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from paddleocr import PaddleOCR
from pydantic import BaseModel


app = FastAPI(title="Doc Extractor", version="1.0.0")

_ocr = None


class ExtractRequest(BaseModel):
    MediaUrl: str
    MimeType: str | None = ""
    Caption: str | None = ""


def normalize_document_digits(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    return digits if len(digits) in (11, 14) else ""


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.lower()
    return re.sub(r"\s+", " ", text).strip()


def get_ocr() -> PaddleOCR:
    global _ocr
    if _ocr is None:
        _ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
    return _ocr


def rewrite_service_url(value: str, target_base_url: str) -> str:
    if not value:
        return ""

    try:
        from urllib.parse import urlparse, urlunparse

        source = urlparse(value)
        target = urlparse(target_base_url)
        return urlunparse(
            (
                target.scheme or source.scheme,
                target.netloc or source.netloc,
                source.path,
                source.params,
                source.query,
                source.fragment,
            )
        )
    except Exception:
        return value


def box_to_rect(box: Any) -> tuple[float, float, float, float]:
    if box is None:
        return (0.0, 0.0, 0.0, 0.0)

    if hasattr(box, "tolist"):
        box = box.tolist()

    if isinstance(box, (list, tuple)) and len(box) == 4 and all(
        isinstance(x, (int, float)) for x in box
    ):
        x1, y1, x2, y2 = box
        return (float(x1), float(y1), float(x2), float(y2))

    if isinstance(box, (list, tuple)) and len(box) >= 4:
        xs = [float(point[0]) for point in box]
        ys = [float(point[1]) for point in box]
        return (min(xs), min(ys), max(xs), max(ys))

    return (0.0, 0.0, 0.0, 0.0)


def extract_ocr_items(image_path: str) -> list[dict[str, Any]]:
    result = get_ocr().predict(image_path)
    items: list[dict[str, Any]] = []

    for page in result:
        payload = getattr(page, "res", page)
        if not isinstance(payload, dict):
            continue

        texts = payload.get("rec_texts")
        boxes = payload.get("rec_boxes")
        scores = payload.get("rec_scores")

        if texts is None:
            texts = []
        if boxes is None:
            boxes = payload.get("dt_polys")
        if boxes is None:
            boxes = []
        if scores is None:
            scores = []

        for index, text in enumerate(texts):
            text = str(text or "").strip()
            if not text:
                continue

            x1, y1, x2, y2 = box_to_rect(boxes[index] if index < len(boxes) else None)
            items.append(
                {
                    "text": text,
                    "normalized": normalize_text(text),
                    "score": float(scores[index]) if index < len(scores) else 0.0,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "xc": (x1 + x2) / 2,
                    "yc": (y1 + y2) / 2,
                    "height": max(1.0, y2 - y1),
                }
            )

    return items


def group_items_into_lines(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not items:
        return []

    sorted_items = sorted(items, key=lambda item: (item["yc"], item["x1"]))
    heights = [item["height"] for item in sorted_items]
    threshold = max(10.0, (median(heights) if heights else 12.0) * 0.75)
    grouped: list[list[dict[str, Any]]] = []

    for item in sorted_items:
        if not grouped:
            grouped.append([item])
            continue

        current_line = grouped[-1]
        current_y = sum(entry["yc"] for entry in current_line) / len(current_line)
        if abs(item["yc"] - current_y) <= threshold:
            current_line.append(item)
        else:
            grouped.append([item])

    lines: list[dict[str, Any]] = []
    for index, line_items in enumerate(grouped):
        line_items.sort(key=lambda item: item["x1"])
        line_text = " ".join(item["text"] for item in line_items).strip()
        lines.append(
            {
                "index": index,
                "text": line_text,
                "normalized": normalize_text(line_text),
                "x1": min(item["x1"] for item in line_items),
                "x2": max(item["x2"] for item in line_items),
                "y1": min(item["y1"] for item in line_items),
                "y2": max(item["y2"] for item in line_items),
                "items": line_items,
            }
        )

    return lines


def find_formatted_document(text: str) -> str:
    patterns = [
        r"(?<!\d)(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})(?!\d)",
        r"(?<!\d)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?!\d)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue

        normalized = normalize_document_digits(match.group(1))
        if normalized:
            return normalized

    return ""


def line_has_label(normalized_text: str) -> bool:
    return any(
        label in normalized_text
        for label in ("cpf/cnpj", "cpf cnpj", "cpfcnpj", "cnpj/cpf", "cpf", "cnpj")
    )


def extract_from_labeled_lines(lines: list[dict[str, Any]]) -> tuple[str, str]:
    for line in lines:
        if not line_has_label(line["normalized"]):
            continue

        candidate = find_formatted_document(line["text"])
        if candidate:
            return candidate, line["text"]

        for next_index in range(line["index"] + 1, min(line["index"] + 3, len(lines))):
            next_line = lines[next_index]
            candidate = find_formatted_document(next_line["text"])
            if candidate:
                return candidate, next_line["text"]

    return "", ""


def extract_from_label_neighbors(items: list[dict[str, Any]]) -> tuple[str, str]:
    label_items = [item for item in items if line_has_label(item["normalized"])]
    if not label_items:
        return "", ""

    for label in label_items:
        nearby = [
            item
            for item in items
            if item["yc"] >= label["y1"] - 10
            and item["yc"] <= label["y2"] + max(80.0, label["height"] * 4)
            and item["x1"] >= label["x1"] - 60
            and item["x1"] <= label["x2"] + 360
            and item["text"] != label["text"]
        ]
        nearby.sort(key=lambda item: (abs(item["yc"] - label["yc"]), item["x1"]))

        for candidate_item in nearby:
            candidate = find_formatted_document(candidate_item["text"])
            if candidate:
                return candidate, candidate_item["text"]

    return "", ""


def build_relevant_context(lines: list[dict[str, Any]]) -> str:
    for line in lines:
        if not line_has_label(line["normalized"]):
            continue

        selected = [line["text"]]
        for next_index in range(line["index"] + 1, min(line["index"] + 3, len(lines))):
            selected.append(lines[next_index]["text"])
        return "\n".join(selected)

    return "\n".join(line["text"] for line in lines[:8])


def llm_extract_from_context(context_text: str) -> tuple[str, str]:
    if not context_text.strip():
        return "", ""

    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    ollama_model = os.getenv("OLLAMA_TEXT_MODEL", "llama3:latest")
    prompt = "\n".join(
        [
            "Abaixo estao linhas OCR de um boleto.",
            "Extraia o CPF ou CNPJ do pagador ou cliente.",
            "Responda apenas com o numero. Se nao encontrar, responda NULO.",
            "",
            context_text,
        ]
    )

    response = requests.post(
        f"{ollama_base_url}/api/chat",
        json={
            "model": ollama_model,
            "stream": False,
            "options": {"temperature": 0},
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    raw_content = str(payload.get("message", {}).get("content", "")).strip()
    return normalize_document_digits(raw_content), raw_content


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract-document")
def extract_document(request: ExtractRequest) -> dict[str, Any]:
    media_url = rewrite_service_url(
        request.MediaUrl,
        os.getenv("WAHA_INTERNAL_BASE_URL", "http://waha:3000"),
    )

    headers = {}
    if os.getenv("WAHA_API_KEY"):
        headers["X-Api-Key"] = os.getenv("WAHA_API_KEY")

    response = requests.get(media_url, headers=headers, timeout=120)
    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao baixar imagem do WAHA: {response.status_code} {response.reason}",
        )

    suffix = ".jpg"
    lower_mime = (request.MimeType or "").lower()
    if "png" in lower_mime:
        suffix = ".png"
    elif "webp" in lower_mime:
        suffix = ".webp"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(response.content)
        temp_path = temp_file.name

    try:
        items = extract_ocr_items(temp_path)
        lines = group_items_into_lines(items)
        full_preview = "\n".join(line["text"] for line in lines[:20])

        document, raw_document = extract_from_labeled_lines(lines)
        reason = "paddle_label_line" if document else "paddle_label_line_not_found"

        if not document:
            document, raw_document = extract_from_label_neighbors(items)
            reason = "paddle_neighbor_box" if document else "paddle_neighbor_box_not_found"

        relevant_context = build_relevant_context(lines)
        if not document:
            llm_document, llm_raw = llm_extract_from_context(relevant_context)
            if llm_document:
                document = llm_document
                raw_document = llm_raw
                reason = "ollama_context_fallback"
            else:
                raw_document = llm_raw
                reason = "ollama_context_not_found"

        return {
            "Success": True,
            "Found": bool(document),
            "Document": document,
            "Confidence": "high" if document else "low",
            "Reason": reason,
            "RawDocument": raw_document or None,
            "Model": os.getenv("OLLAMA_TEXT_MODEL", "llama3:latest"),
            "UsedMediaUrl": media_url,
            "MimeType": request.MimeType or response.headers.get("content-type", ""),
            "OcrPreview": full_preview[:2000],
            "FocusedOcrPreview": relevant_context[:1000],
        }
    except requests.HTTPError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
