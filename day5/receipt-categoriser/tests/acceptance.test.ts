// acceptance.test.ts
// Tests for AC-01, AC-03, AC-04, AC-02, AC-05 from acceptance.md
// Run with: npm test

import { categorise } from "../src/categoriser";
import { runRuleBased } from "../src/rule-based-categoriser";
import * as llmCategoriser from "../src/llm-categoriser";

// --- AC-01: Happy path — clear meal receipt ---
test("AC-01: clear meal receipt returns Meals with confidence >= 0.7 from llm", async () => {
  // Mock OCR returns restaurant text
  jest.spyOn(llmCategoriser, "extractTextFromBlob").mockResolvedValue(
    "McDonald's Colombo 03 — Burger Meal x2 — Total LKR 2400"
  );
  // Mock LLM returns Meals with high confidence
  jest.spyOn(llmCategoriser, "suggestCategoryWithLLM").mockResolvedValue({
    category: "Meals",
    confidence: 0.91,
    source: "llm",
    needsReview: false,
  });

  const result = await categorise({ receiptBlobKey: "receipts/claim-abc/receipt-001.jpg", claimId: "claim-abc" });

  expect(result.category).toBe("Meals");
  expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  expect(result.source).toBe("llm");
  expect(result.needsReview).toBe(false);
});

// --- AC-02: Ambiguous receipt — mixed items ---
test("AC-02: ambiguous receipt returns needsReview = true with confidence < 0.6", async () => {
  jest.spyOn(llmCategoriser, "extractTextFromBlob").mockResolvedValue(
    "Keells Super — Lunch pack LKR 350, Pen x2 LKR 120 — Total LKR 470"
  );
  jest.spyOn(llmCategoriser, "suggestCategoryWithLLM").mockResolvedValue({
    category: "Office Supplies",
    confidence: 0.48,
    source: "llm",
    needsReview: true,
  });

  const result = await categorise({ receiptBlobKey: "receipts/claim-def/receipt-002.png", claimId: "claim-def" });

  expect(result.confidence).toBeLessThan(0.6);
  expect(result.needsReview).toBe(true);
  expect(["Meals", "Travel", "Lodging", "Office Supplies", "Other"]).toContain(result.category);
  expect(result.source).toBe("llm");
});

// --- AC-03: LLM unavailable — fallback to rule-based ---
test("AC-03: LLM returns 503 → source is rule-based, confidence <= 0.5", async () => {
  // OCR works fine
  jest.spyOn(llmCategoriser, "extractTextFromBlob").mockResolvedValue(
    "Uber Sri Lanka — Trip fare LKR 850"
  );
  // LLM fails → returns null
  jest.spyOn(llmCategoriser, "suggestCategoryWithLLM").mockResolvedValue(null);

  const result = await categorise({ receiptBlobKey: "receipts/claim-ghi/receipt-003.jpg", claimId: "claim-ghi" });

  expect(result.source).toBe("rule-based");
  expect(result.confidence).toBeLessThanOrEqual(0.5);
  expect(result.needsReview).toBe(true);
  expect(["Meals", "Travel", "Lodging", "Office Supplies", "Other"]).toContain(result.category);
});

// --- AC-04: OCR failure — Document Intelligence unavailable ---
test("AC-04: OCR fails → category Other, confidence 0.0, source rule-based", async () => {
  // OCR fails → returns null
  jest.spyOn(llmCategoriser, "extractTextFromBlob").mockResolvedValue(null);

  const result = await categorise({ receiptBlobKey: "receipts/claim-jkl/receipt-004.jpg", claimId: "claim-jkl" });

  expect(result.category).toBe("Other");
  expect(result.confidence).toBe(0.0);
  expect(result.source).toBe("rule-based");
  expect(result.needsReview).toBe(true);
});

// --- AC-06: PII boundary — rule-based result contains no PII ---
test("AC-06: rule-based result does not include memberId or raw OCR text", () => {
  const result = runRuleBased("Kasun Perera — Office chair LKR 12500 — Card: 4242");

  // Result shape only contains allowed fields
  expect(result).toHaveProperty("category");
  expect(result).toHaveProperty("confidence");
  expect(result).toHaveProperty("source");
  expect(result).toHaveProperty("needsReview");

  // No PII fields
  expect(result).not.toHaveProperty("memberId");
  expect(result).not.toHaveProperty("customerName");
  expect(result).not.toHaveProperty("ocrText");
  expect(result).not.toHaveProperty("cardNumber");
});

// Reset mocks after each test
afterEach(() => {
  jest.restoreAllMocks();
});
