# AI Implementation Prompt — Template

**Purpose:** Spec-led prompt template used for this implementation.  
**Rule:** Paste spec first, then narrow instructions. Never ask chattily.

---

## Template used

```
You are implementing a feature in TypeScript.
Below is the complete spec and acceptance criteria.
Implement so all acceptance criteria can pass.

Constraints:
- Touch only files under src/ and tests/
- Do NOT invent fields, endpoints, or behaviour not in the spec
- Output shape must be exactly: { category, confidence, source, needsReview }
- Before writing code, list ambiguities you want clarified

[paste spec.md]
[paste acceptance.md]
```

---

## Why spec-led prompting works

- AI follows the contract, not its assumptions
- Constraints prevent invented fields (e.g. tags)
- Asking for ambiguities first surfaces gaps before code is written
- Narrowing to specific files stops scope creep
