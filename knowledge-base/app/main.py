import json
import math
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from docx import Document
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="Knowledge Base", version="1.0.0")

_index_cache: dict[str, Any] | None = None

SUPPORTED_EXTENSIONS = {".txt", ".md", ".docx"}
STOPWORDS = {
    "a",
    "ao",
    "aos",
    "as",
    "com",
    "como",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "essa",
    "esse",
    "esta",
    "este",
    "eu",
    "foi",
    "mais",
    "na",
    "nas",
    "no",
    "nos",
    "o",
    "os",
    "ou",
    "para",
    "por",
    "qual",
    "quais",
    "que",
    "se",
    "sem",
    "ser",
    "sua",
    "suas",
    "suas",
    "seu",
    "seus",
    "um",
    "uma",
    "uns",
    "umas",
}


class AnswerRequest(BaseModel):
    Question: str
    Telefone: str | None = None
    MaxChunks: int | None = None


def normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.lower()
    return re.sub(r"\s+", " ", text).strip()


def tokenize(value: str | None) -> list[str]:
    normalized = normalize_text(value)
    tokens = re.findall(r"[a-z0-9]{2,}", normalized)
    return [token for token in tokens if token not in STOPWORDS]


def get_source_dir() -> Path:
    return Path(os.getenv("KNOWLEDGE_BASE_SOURCE_DIR", "/app/source"))


def get_index_dir() -> Path:
    return Path(os.getenv("KNOWLEDGE_BASE_INDEX_DIR", "/app/index"))


def get_top_k() -> int:
    return max(1, int(os.getenv("KNOWLEDGE_BASE_TOP_K", "4")))


def get_min_score() -> float:
    return float(os.getenv("KNOWLEDGE_BASE_MIN_SCORE", "1.2"))


def get_openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def read_supported_file(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    if suffix == ".docx":
        document = Document(str(file_path))
        paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        return "\n".join(paragraphs)

    return file_path.read_text(encoding="utf-8", errors="ignore")


def chunk_text(text: str, source_name: str, max_chars: int = 900, overlap_chars: int = 180) -> list[dict[str, Any]]:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}|\r\n{2,}", text) if part.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[dict[str, Any]] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append({"source": source_name, "text": current})

        if len(paragraph) <= max_chars:
            current = paragraph
            continue

        start = 0
        while start < len(paragraph):
            end = min(len(paragraph), start + max_chars)
            piece = paragraph[start:end].strip()
            if piece:
                chunks.append({"source": source_name, "text": piece})
            if end >= len(paragraph):
                break
            start = max(0, end - overlap_chars)
        current = ""

    if current:
        chunks.append({"source": source_name, "text": current})

    return chunks


def calculate_signature(files: list[Path]) -> list[dict[str, Any]]:
    signature: list[dict[str, Any]] = []
    for file_path in files:
        stat = file_path.stat()
        signature.append(
            {
                "path": str(file_path.relative_to(get_source_dir())).replace("\\", "/"),
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
            }
        )
    return signature


def build_index() -> dict[str, Any]:
    global _index_cache

    source_dir = get_source_dir()
    source_dir.mkdir(parents=True, exist_ok=True)
    index_dir = get_index_dir()
    index_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(
        [
            file_path
            for file_path in source_dir.rglob("*")
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
    )
    signature = calculate_signature(files)

    if _index_cache and _index_cache.get("signature") == signature:
        return _index_cache

    chunks: list[dict[str, Any]] = []
    document_frequency: dict[str, int] = {}

    for file_path in files:
        raw_text = read_supported_file(file_path)
        for chunk_index, chunk in enumerate(
            chunk_text(raw_text, str(file_path.relative_to(source_dir)).replace("\\", "/"))
        ):
            tokens = tokenize(chunk["text"])
            if not tokens:
                continue

            unique_tokens = set(tokens)
            for token in unique_tokens:
                document_frequency[token] = document_frequency.get(token, 0) + 1

            chunks.append(
                {
                    "id": f"{chunk['source']}#{chunk_index}",
                    "source": chunk["source"],
                    "text": chunk["text"],
                    "normalized": normalize_text(chunk["text"]),
                    "tokens": tokens,
                    "token_set": unique_tokens,
                }
            )

    chunk_count = max(1, len(chunks))
    idf = {
        token: math.log((1 + chunk_count) / (1 + frequency)) + 1
        for token, frequency in document_frequency.items()
    }

    index_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "signature": signature,
        "chunk_count": len(chunks),
        "sources": sorted({chunk["source"] for chunk in chunks}),
    }
    (index_dir / "index-summary.json").write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    _index_cache = {
        "signature": signature,
        "chunks": chunks,
        "idf": idf,
        "source_dir": str(source_dir),
        "index_dir": str(index_dir),
    }
    return _index_cache


def rank_chunks(question: str, max_chunks: int) -> list[dict[str, Any]]:
    index = build_index()
    query_tokens = tokenize(question)
    if not query_tokens:
        return []

    query_token_set = set(query_tokens)
    ranked: list[dict[str, Any]] = []

    for chunk in index["chunks"]:
        overlap = query_token_set.intersection(chunk["token_set"])
        if not overlap:
            continue

        weighted_overlap = sum(index["idf"].get(token, 1.0) for token in overlap)
        phrase_bonus = 0.0
        normalized_question = normalize_text(question)
        if normalized_question and normalized_question in chunk["normalized"]:
            phrase_bonus += 1.5

        score = weighted_overlap + phrase_bonus
        ranked.append(
            {
                "id": chunk["id"],
                "source": chunk["source"],
                "text": chunk["text"],
                "score": round(score, 4),
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:max_chunks]


def generate_answer(question: str, chunks: list[dict[str, Any]]) -> str:
    context = "\n\n".join(
        f"[Fonte: {chunk['source']}]\n{chunk['text']}" for chunk in chunks
    )
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY nao configurada.")

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": get_openai_model(),
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Voce responde perguntas institucionais da Nippon Elevadores "
                        "usando somente o contexto fornecido. Responda em portugues "
                        "do Brasil, de forma direta, objetiva e curta, com no maximo "
                        "2 frases. Quando a pergunta pedir numero, contato ou telefone "
                        "da empresa, use o telefone do contexto se ele estiver presente. "
                        "Se o contexto nao responder a pergunta com "
                        "seguranca, responda exatamente: SEM_RESPOSTA"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Pergunta: {question}\n\nContexto:\n{context}",
                },
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    return str(payload.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()


def generate_extractive_answer(chunks: list[dict[str, Any]]) -> str:
    if not chunks:
        return ""

    text = re.sub(r"\s+", " ", chunks[0]["text"]).strip()
    if len(text) <= 320:
        return text
    return text[:317].rstrip() + "..."


@app.get("/health")
def health() -> dict[str, Any]:
    index = build_index()
    return {
        "status": "ok",
        "sourceDir": index["source_dir"],
        "indexDir": index["index_dir"],
        "chunkCount": len(index["chunks"]),
    }


@app.post("/answer")
def answer_question(request: AnswerRequest) -> dict[str, Any]:
    question = (request.Question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question e obrigatoria.")

    try:
        max_chunks = request.MaxChunks or get_top_k()
        ranked_chunks = rank_chunks(question, max_chunks)

        if not ranked_chunks:
            return {
                "success": True,
                "found": False,
                "answer": "",
                "confidence": 0.0,
                "sources": [],
                "topScore": 0.0,
            }

        top_score = float(ranked_chunks[0]["score"])
        if top_score < get_min_score():
            return {
                "success": True,
                "found": False,
                "answer": "",
                "confidence": round(top_score, 4),
                "sources": [chunk["source"] for chunk in ranked_chunks],
                "topScore": round(top_score, 4),
            }

        try:
            raw_answer = generate_answer(question, ranked_chunks)
        except requests.RequestException:
            raw_answer = generate_extractive_answer(ranked_chunks)

        normalized_answer = normalize_text(raw_answer)
        if not raw_answer or normalized_answer == "sem_resposta":
            return {
                "success": True,
                "found": False,
                "answer": "",
                "confidence": round(top_score, 4),
                "sources": [chunk["source"] for chunk in ranked_chunks],
                "topScore": round(top_score, 4),
            }

        return {
            "success": True,
            "found": True,
            "answer": raw_answer,
            "confidence": round(top_score, 4),
            "sources": [chunk["source"] for chunk in ranked_chunks],
            "topScore": round(top_score, 4),
        }
    except requests.HTTPError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
