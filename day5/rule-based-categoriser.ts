// categoriser.ts
// Main entry point — orchestrates OCR → LLM → rule-based fallback
// Called by the Categoriser Controller in the Claims API

import { CategoriserResult, runRuleBased } from "./rule-based-categoriser";
import { extractTextFromBlob, suggestCategoryWithLLM } from "./llm-categoriser";

export interface CategoriseInput {
  receiptBlobKey: string;  // key in the `receipts` Blob container
  claimId: string;         // used for logging only — not sent to LLM
}

export async function categorise(input: CategoriseInput): Promise<CategoriserResult> {
  const { receiptBlobKey } = input;

  // Step 1 — OCR via Azure Document Intelligence (timeout: 3 s)
  const ocrText = await extractTextFromBlob(receiptBlobKey);

  // Step 2 — If OCR failed: no text to analyse → return Other immediately
  if (!ocrText) {
    return runRuleBased(""); // empty string → Other, confidence 0.0
  }

  // Step 3 — LLM suggestion via Azure OpenAI gpt-4.1 (timeout: 3 s)
  const llmResult = await suggestCategoryWithLLM(ocrText);

  // Step 4 — If LLM failed: fall back to rule-based on the OCR text
  if (!llmResult) {
    return runRuleBased(ocrText);
  }

  // Step 5 — LLM succeeded: return result
  return llmResult;
}
