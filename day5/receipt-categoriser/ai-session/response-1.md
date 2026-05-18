# AI Session — Response 1

**Date:** 2026-05-17  
**Prompt:** prompt-1.md  

---

## Ambiguities the AI flagged before coding

- OQ-1: Is the 0.6 threshold hardcoded or configurable? → assumed hardcoded for now
- OQ-4: Does cost cap apply to this implementation? → ignored, no pricing logic needed in code
- OQ-5: Explicit call or auto-trigger? → assumed explicit call per spec

---

## What the AI produced

The AI produced all 3 files with correct structure.

**Correct:**
- `categoriser.ts` — OCR → LLM → fallback flow matched the spec exactly
- `rule-based-categoriser.ts` — keyword map, confidence capped at 0.5
- LLM timeout at 3 s, OCR timeout at 3 s
- `needsReview = confidence < 0.6`
- OCR failure → Other, confidence 0.0

---

## ⚠️ Deviation found — AI invented a `tags` field

The AI added an extra field to the output:

```typescript
// AI produced this — NOT in the spec
return {
  category,
  confidence,
  source: "llm",
  needsReview: confidence < 0.6,
  tags: extractedKeywords,  // ← INVENTED — not in spec
};
```

**Why this is wrong:**
- Spec Section 3 (Contract → Outputs) defines exactly 4 fields: `category`, `confidence`, `source`, `needsReview`
- `tags` is not in any part of the spec
- Adding it would break AC-06 (PII boundary) — extracted keywords could contain vendor names

**Fix applied:**
- Removed `tags` field from `llm-categoriser.ts` return value
- Added a test assertion: `expect(result).not.toHaveProperty("tags")`

---

## Second deviation — confidence not clamped correctly

The AI produced:

```typescript
const confidence = parsed.confidence; // no clamping
```

**Why this is wrong:**
- LLM could return confidence > 1.0 or < 0.0 if the model misbehaves
- Spec says confidence is 0.0 – 1.0

**Fix applied:**
```typescript
const confidence = Math.min(1.0, Math.max(0.0, parseFloat(parsed.confidence.toFixed(2))));
```
