"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPool } from "@/lib/db";

const parametroSchema = z.object({
  chave: z.string().trim().min(1),
  valor: z.string().trim()
});

const templateSchema = z.object({
  id: z.coerce.number().int().positive(),
  conteudo: z.string().trim().min(1, "O conteúdo do template não pode ficar vazio.")
});

export async function atualizarParametro(_previous: { ok: boolean; error: string }, formData: FormData) {
  const parse = parametroSchema.safeParse({
    chave: String(formData.get("chave") || ""),
    valor: String(formData.get("valor") || "")
  });

  if (!parse.success) {
    return { ok: false, error: parse.error.issues[0]?.message || "Parâmetro inválido." };
  }

  try {
    await getPool().query(
      "UPDATE parametros_mvp SET valor = $2 WHERE chave = $1",
      [parse.data.chave, parse.data.valor]
    );
    revalidatePath("/configuracoes");
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar parâmetro." };
  }
}

export async function atualizarTemplate(_previous: { ok: boolean; error: string }, formData: FormData) {
  const parse = templateSchema.safeParse({
    id: String(formData.get("id") || ""),
    conteudo: String(formData.get("conteudo") || "")
  });

  if (!parse.success) {
    return { ok: false, error: parse.error.issues[0]?.message || "Template inválido." };
  }

  try {
    await getPool().query(
      "UPDATE templates_mensagem SET conteudo = $2, updated_at = NOW() WHERE id = $1",
      [parse.data.id, parse.data.conteudo]
    );
    revalidatePath("/configuracoes");
    return { ok: true, error: "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar template." };
  }
}
