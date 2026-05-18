// llm-categoriser.ts
// LLM path — calls Azure Document Intelligence (OCR) then Azure OpenAI gpt-4.1
// Both use BISTEC tenant endpoints (not public OpenAI)

import { Category, CategoriserResult } from "./rule-based-categoriser";

const VALID_CATEGORIES: Category[] = [
  "Meals", "Travel", "Lodging", "Office Supplies", "Other",
];

const OCR_TIMEOUT_MS  = 3000; // spec: 3 s timeout for Document Intelligence
const LLM_TIMEOUT_MS  = 3000; // spec: 3 s timeout for Azure OpenAI

// --- OCR via Azure Document Intelligence ---

export async function extractTextFromBlob(blobKey: string): Promise<string | null> {
  try {
    const endpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT!;
    const apiKey   = process.env.DOCUMENT_INTELLIGENCE_KEY!;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    const res = await fetch(`${endpoint}/formrecognizer/documentModels/prebuilt-receipt:analyze?api-version=2023-07-31`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urlSource: blobKey }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null; // OCR unavailable → caller uses rule-based

    const data = await res.json();
    // Extract all text content from the OCR result
    const content: string = data?.analyzeResult?.content ?? "";
    return content.trim() || null;

  } catch {
    // Timeout or network error → treat as OCR failure
    return null;
  }
}

// --- Category suggestion via Azure OpenAI gpt-4.1 ---

export async function suggestCategoryWithLLM(ocrText: string): Promise<CategoriserResult | null> {
  try {
    const endpoint   = process.env.AZURE_OPENAI_ENDPOINT!;
    const apiKey     = process.env.AZURE_OPENAI_KEY!;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4-1";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const prompt = `
You are an expense categoriser for a corporate reimbursement system.
Given the text extracted from a receipt, return a JSON object with:
- "category": one of exactly ["Meals","Travel","Lodging","Office Supplies","Other"]
- "confidence": a float between 0.0 and 1.0

Rules:
- Return ONLY valid JSON. No explanation. No markdown.
- If the receipt is ambiguous, lower the confidence.
- If you cannot determine the category, use "Other" with confidence 0.0.

Receipt text:
${ocrText}
`.trim();

    const res = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 60,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null; // LLM unavailable → caller uses rule-based

    const data  = await res.json();
    const text  = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text.trim());

    const category: Category = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : "Other";

    const confidence = typeof parsed.confidence === "number"
      ? Math.min(1.0, Math.max(0.0, parseFloat(parsed.confidence.toFixed(2))))
      : 0.0;

    return {
      category,
      confidence,
      source: "llm",
      needsReview: confidence < 0.6,
    };

  } catch {
    // Timeout, network error, or JSON parse failure → caller uses rule-based
    return null;
  }
}
