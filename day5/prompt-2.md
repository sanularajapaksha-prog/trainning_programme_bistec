# Receipt Categoriser

GreenChit — AI-powered receipt category suggester.  
Built inside the Claims API (Day 4 GreenChit design).

---

## Run the tests

```bash
npm install
npm test
```

---

## Required environment variables

```
DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-instance.cognitiveservices.azure.com
DOCUMENT_INTELLIGENCE_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4-1
```

---

## Structure

```
spec/          spec.md + acceptance.md
src/           categoriser.ts (entry), llm-categoriser.ts, rule-based-categoriser.ts
tests/         acceptance.test.ts (covers AC-01, AC-02, AC-03, AC-04, AC-06)
ai-session/    prompt-1.md, response-1.md, prompt-2.md, response-2.md
```

---

## AI session summary

| # | Prompt | Deviation found | Fix |
|---|--------|-----------------|-----|
| 1 | First implementation pass | AI invented `tags` field not in spec | Removed tags, added test assertion |
| 1 | First implementation pass | Confidence not clamped to 0.0–1.0 | Added Math.min/max clamp |
| 2 | Fix deviations + write tests | None — matched spec fully | No fix needed |
