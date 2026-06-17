"use server";

import OpenAI from "openai";
import { z } from "zod";

import { AgentSchemaContract } from "@/lib/agentSchemaContract";
import { getPool } from "@/lib/db";

const allowedTables = AgentSchemaContract.getAllowedTables();

const requestSchema = z.object({
  question: z.string().trim().min(4, "Escreva uma pergunta com pelo menos 4 caracteres.").max(500)
});

type SqlPlan = {
  sql: string;
  rationale: string;
};

type ChatState = {
  requestId: string;
  ok: boolean;
  question: string;
  answer: string;
  sql: string;
  rowsCount: number;
  error: string;
};

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no frontend.");
  }

  if (!model) {
    throw new Error("OPENAI_MODEL não configurado no frontend.");
  }

  return { apiKey, model };
}

function extractJsonObject(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("A LLM não retornou JSON válido para o planejamento da consulta.");
  }
  return JSON.parse(match[0]);
}

function extractTables(sql: string) {
  const regex = /\b(?:from|join)\s+([a-z0-9_."]+)/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(sql))) {
    const raw = match[1].replace(/"/g, "");
    const table = raw.includes(".") ? raw.split(".").pop() || raw : raw;
    found.add(table.toLowerCase());
  }

  return [...found];
}

function normalizeSql(raw: string) {
  const trimmed = raw.trim().replace(/;+$/, "");
  const lowered = trimmed.toLowerCase();

  if (trimmed.includes(";")) {
    throw new Error("A consulta contém delimitador inválido.");
  }

  if (!(lowered.startsWith("select") || lowered.startsWith("with"))) {
    throw new Error("A consulta gerada não é de leitura.");
  }

  if (
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|execute)\b/i.test(
      lowered
    )
  ) {
    throw new Error("A consulta gerada contém comando bloqueado.");
  }

  const tables = extractTables(trimmed);
  for (const table of tables) {
    if (!allowedTables.has(table)) {
      throw new Error(`Tabela não permitida na consulta: ${table}`);
    }
  }

  AgentSchemaContract.validateSql(trimmed);

  const limitMatch = lowered.match(/\blimit\s+(\d+)/i);
  if (!limitMatch) {
    return `${trimmed}\nLIMIT 120`;
  }

  const requestedLimit = Number(limitMatch[1]);
  if (Number.isFinite(requestedLimit) && requestedLimit <= 120) {
    return trimmed;
  }

  return trimmed.replace(/\blimit\s+\d+/i, "LIMIT 120");
}

async function planSqlQuestion(question: string) {
  const { apiKey, model } = getOpenAiConfig();
  const client = new OpenAI({ apiKey });
  const schemaSummary = AgentSchemaContract.renderSchemaSummary();

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: AgentSchemaContract.renderSystemPrompt()
      },
      {
        role: "user",
        content: `Pergunta do gestor: ${question}\n\nSchema:\n${schemaSummary}`
      }
    ]
  });

  const message = completion.choices[0]?.message?.content || "";
  const parsed = extractJsonObject(message) as SqlPlan;
  if (!parsed.sql) {
    throw new Error("A LLM não retornou a SQL.");
  }
  return parsed;
}

async function generateNarrativeAnswer(question: string, sql: string, rows: Record<string, unknown>[]) {
  const { apiKey, model } = getOpenAiConfig();
  const client = new OpenAI({ apiKey });

  const payload = JSON.stringify(rows).slice(0, 13000);

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente gerencial de cobrança. Responda em português do Brasil, com linguagem objetiva para tomada de decisão. Sempre destaque números relevantes e riscos de inadimplência."
      },
      {
        role: "user",
        content: `Pergunta: ${question}\nSQL executada: ${sql}\nDados retornados em JSON: ${payload}`
      }
    ]
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Não foi possível gerar uma resposta textual para os dados retornados."
  );
}

export async function askManagerAssistant(_previous: ChatState, formData: FormData): Promise<ChatState> {
  const requestId = `${Date.now()}`;
  const parse = requestSchema.safeParse({
    question: String(formData.get("question") || "")
  });

  if (!parse.success) {
    return {
      requestId,
      ok: false,
      question: "",
      answer: "",
      sql: "",
      rowsCount: 0,
      error: parse.error.issues[0]?.message || "Pergunta inválida."
    };
  }

  const question = parse.data.question;

  try {
    const plan = await planSqlQuestion(question);
    const safeSql = normalizeSql(plan.sql);
    const result = await getPool().query(safeSql);
    const rows = result.rows as Record<string, unknown>[];
    const answer = await generateNarrativeAnswer(question, safeSql, rows);

    return {
      requestId,
      ok: true,
      question,
      answer,
      sql: safeSql,
      rowsCount: rows.length,
      error: ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o assistente gerencial.";
    return {
      requestId,
      ok: false,
      question,
      answer: "",
      sql: "",
      rowsCount: 0,
      error: message
    };
  }
}
