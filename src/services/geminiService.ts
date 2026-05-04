import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL_NAME = "gemini-2.0-flash-lite";

export interface HealthReport {
  score: number;
  keywords: string[];
  weaknesses: string[];
}

export interface ImprovementItem {
  section: string;
  original: string;
  proposed: string;
  reason: string;
}

export interface AnalysisResponse {
  report: HealthReport;
  improvementPlan: ImprovementItem[];
}

const ANALYSIS_SYSTEM_INSTRUCTION = `
Actúas como el backend inteligente de una aplicación de optimización laboral IT.
Tu flujo de trabajo es estrictamente secuencial y orientado a la acción.

REGLAS DE IDIOMA:
1. El "report" (Health Report) y razones de cambio deben ser SIEMPRE EN ESPAÑOL.
2. La "proposed" (Propuesta de IA) debe estar EN EL MISMO IDIOMA que el CV original.

Paso 1: Auditoría
Genera un "Reporte de Salud Profesional" con:
- Puntuación de Impacto (1-100).
- Análisis de Keywords (aptitud para filtros ATS de tecnología y diseño).
- Debilidades Detectadas (máximo 5 puntos críticos).

Paso 2: Propuesta de Cambio
Genera una tabla comparativa titulada "Plan de Mejora" con:
- Sección Original.
- Propuesta de IA (lenguaje orientado a resultados, logros > tareas).
- Razón del Cambio (EXPLICADA EN ESPAÑOL).

Responde estrictamente en formato JSON.
`;

const OPTIMIZE_SYSTEM_INSTRUCTION = `
Actúas como un experto en reclutamiento IT de clase mundial.
Tu tarea es entregar el CV Final Optimizado en un formato estructurado y profesional.

REGLAS DE IDIOMA:
- El CV debe estar EXACTAMENTE en el mismo idioma que el CV original. No traduzcas títulos ni contenido. Si el CV original está en inglés, el resultado DEBE ser en inglés. Si es en español, el resultado DEBE ser en español.

REGLAS DE FORMATO Y ENLACES (CRÍTICO):
- Los enlaces (LinkedIn, Portfolio, GitHub, etc.) DEBEN escribirse como TEXTO PLANO COMPLETO.
- NUNCA uses la sintaxis de Markdown [Texto](url).
- EJEMPLO CORRECTO: https://www.linkedin.com/in/usuario/
- EJEMPLO INCORRECTO: [LinkedIn](https://www.linkedin.com/in/usuario/)
- Estructura: Usa # para el nombre, ## para secciones grandes y ### para cargos/empresas.
- No inventes información. Si faltan datos, usa placeholders o deja el espacio.
`;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const is429 = error?.message?.includes("429") || error?.message?.includes("quota");
      if (!is429 || attempt === maxRetries - 1) throw err;

      const retryMatch = error.message?.match(/retryDelay":"(\d+)s/);
      const waitSeconds = retryMatch ? parseInt(retryMatch[1]) + 2 : (attempt + 1) * 15;
      console.warn(`Rate limited. Retrying in ${waitSeconds}s... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((res) => setTimeout(res, waitSeconds * 1000));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function analyzeCV(cvText: string): Promise<AnalysisResponse> {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
      },
      contents: cvText,
    });

    const text = response.text ?? "";
    return JSON.parse(text || "{}");
  });
}

export async function optimizeCV(cvText: string, plan: ImprovementItem[]): Promise<string> {
  return withRetry(async () => {
    const prompt = `
CV Original:
${cvText}

Plan de Mejora a aplicar:
${JSON.stringify(plan, null, 2)}

Por favor, genera el CV final optimizado siguiendo las instrucciones del sistema.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: {
        systemInstruction: OPTIMIZE_SYSTEM_INSTRUCTION,
      },
      contents: prompt,
    });

    return response.text ?? "";
  });
}
