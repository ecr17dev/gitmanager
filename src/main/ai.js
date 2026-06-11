import OpenAI from 'openai';
import { z } from 'zod';

let client = null;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-key-here') {
    throw new Error(
      'OPENAI_API_KEY no configurada. Define la variable en .env o en tu entorno.'
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

const CommitSchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().max(2000)
});

const DiagnosisSchema = z.object({
  explicacion: z.string().min(10).max(3000),
  pasos: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        command: z.string().min(1).max(500)
      })
    )
    .min(1)
    .max(10)
});

async function callWithRetry(fn, { tries = 2, baseDelay = 600 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === tries - 1) break;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function generateCommitMessage(diffText) {
  const cleanedDiff = (diffText || '').trim() || 'Sin cambios detectados.';
  const openai = getClient();

  const response = await callWithRetry(() =>
    openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "Eres un motor automatizado de Git. Tu única tarea es analizar el 'git diff' provisto y generar un mensaje de commit que siga rigurosamente la convención de 'Conventional Commits' (tipos: feat, fix, chore, docs, refactor, perf, test, build, ci, style, revert). Debes responder exclusivamente con un objeto JSON válido con las claves 'title' y 'body'.\n\nReglas:\n- 'title': máximo 72 caracteres, en minúsculas salvo acrónimos, sin punto final.\n- 'body': opcional, 1-4 líneas separadas por '\\n' describiendo el porqué y notas relevantes para el revisor.\n- No inventes información que no esté en el diff."
        },
        {
          role: 'user',
          content: `Analiza este diff y devuelve únicamente el JSON solicitado:\n\n${cleanedDiff}`
        }
      ]
    })
  );

  const raw = response.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La IA no devolvió un JSON parseable.');
  }
  const result = CommitSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('La IA devolvió un JSON con estructura inválida.');
  }
  return result.data;
}

export async function diagnoseGitError({ stderr, statusText, recentLog }) {
  const openai = getClient();

  const context = `ERROR (stderr):\n${(stderr || '').slice(0, 4000) || '(vacío)'}\n\nESTADO (git status):\n${(statusText || '').slice(0, 2000) || '(vacío)'}\n\nÚLTIMOS COMMITS:\n${(recentLog || '').slice(0, 2000) || '(vacío)'}`;

  const response = await callWithRetry(() =>
    openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            "Eres un asistente experto en recuperación de desastres en Git. Analiza el error y el contexto provistos. Devuelve únicamente un objeto JSON con: 'explicacion' (texto humano, empático, claro, en español) y 'pasos' (array de objetos {label, command} con comandos Git exactos y seguros que el usuario podrá ejecutar uno a uno desde la UI). Los comandos deben ser idempotentes o al menos no destructivos; cuando haya ambigüedad, prefiere operaciones de respaldo (crear rama backup)."
        },
        {
          role: 'user',
          content: `Contexto del problema:\n${context}`
        }
      ]
    })
  );

  const raw = response.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La IA no devolvió un JSON parseable.');
  }
  const result = DiagnosisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Diagnóstico con estructura inválida.');
  }
  return result.data;
}
