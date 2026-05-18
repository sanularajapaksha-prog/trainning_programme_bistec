# AI Session — Prompt 2

**Date:** 2026-05-17  
**Tool:** Claude Sonnet 4.6  
**Goal:** Fix deviations + write acceptance tests

---

## Prompt sent to AI (verbatim)

```
The implementation has two problems. Fix them and write the acceptance tests.

Problem 1 — extra tags field:
Your llm-categoriser.ts returns a tags field that is NOT in the spec.
The output shape must be exactly: { category, confidence, source, needsReview }
Remove tags entirely.

Problem 2 — confidence not clamped:
confidence must always be between 0.0 and 1.0.
Use: Math.min(1.0, Math.max(0.0, parseFloat(parsed.confidence.toFixed(2))))

Now write tests/acceptance.test.ts that:
- Imports categorise from src/categoriser.ts
- Imports runRuleBased from src/rule-based-categoriser.ts
- Mocks extractTextFromBlob and suggestCategoryWithLLM using jest.spyOn
- Covers exactly these criteria:
  AC-01: clear meal receipt → Meals, confidence >= 0.7, source llm
  AC-02: ambiguous receipt → needsReview true, confidence < 0.6
  AC-03: LLM returns null → source rule-based, confidence <= 0.5
  AC-04: OCR returns null → Other, confidence 0.0, source rule-based
  AC-06: result shape has no memberId, ocrText, cardNumber, tags fields

Rules for tests:
- Use jest + ts-jest
- Each test maps to one AC number in a comment
- Call afterEach(() => jest.restoreAllMocks())
- No real HTTP calls — mock everything
```
