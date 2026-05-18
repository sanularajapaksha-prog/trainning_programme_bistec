# AI Session — Prompt 1

**Date:** 2026-05-17  
**Tool:** Claude Sonnet 4.6  
**Goal:** First implementation pass — all 3 source files

---

## Prompt sent to AI (verbatim)

```
You are implementing a feature in TypeScript for a Node.js / Express backend.
Below is the complete spec and acceptance criteria.
Implement the feature so that all acceptance criteria can be made to pass.

Constraints:
- Create exactly 3 files: categoriser.ts, llm-categoriser.ts, rule-based-categoriser.ts
- categoriser.ts is the main entry point
- llm-categoriser.ts handles Azure Document Intelligence OCR + Azure OpenAI gpt-4.1
- rule-based-categoriser.ts handles the keyword fallback
- Do NOT invent fields, endpoints, or behaviour not in the spec
- Do NOT add a tags field, labels field, or any extra output fields
- Output shape must be exactly: { category, confidence, source, needsReview }
- Confidence capped at 0.5 for all rule-based results
- OCR timeout: 3 seconds. LLM timeout: 3 seconds.
- If OCR fails → return Other, confidence 0.0, source rule-based
- If LLM fails → run rule-based on the OCR text
- Before writing code, list any ambiguities in the spec you would want clarified

[SPEC CONTENT PASTED HERE — sanula-day5-receipt-categoriser-spec.md]

[ACCEPTANCE CRITERIA PASTED HERE — sanula-day5-receipt-categoriser-acceptance.md]
```
