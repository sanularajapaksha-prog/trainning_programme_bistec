# Receipt Categoriser — Feature Spec v0.1

**Author:** Sanula  
**Date:** 2026-05-17  
**Status:** Draft  
**System:** GreenChit Claims API (Day 4)

---

## 1. Why

**Problem:**
- Finance staff manually categorise every receipt on every claim
- ~2,000 claims/month = repetitive, error-prone work
- Mis-categorised claims bounce back to claimants → adds 1–2 days to reimbursement cycle

**Outcome we are solving:**
- Claimant uploads receipt → sees suggested category instantly
- Confirms or corrects in one tap → no manual rework for finance

**Metrics this feature will move:**
- Average claim-to-approval time reduced by ≥ 20% within 60 days of launch
- Claims returned for recategorisation drops to < 5% of submissions

---

## 2. Scope

**In scope:**
- New endpoint: `POST /claims/{claimId}/receipts/categorise` inside the existing Claims API
- OCR via Azure AI Document Intelligence (BISTEC tenant)
- Category suggestion via Azure OpenAI gpt-4.1 (BISTEC tenant — not public OpenAI)
- Rule-based fallback when LLM is unavailable
- Feature flag via Azure App Configuration (`greenchit.categoriser.enabled`)
- Logging every suggestion as Application Insights `customEvent: categoriser.suggested`
- Web App UI to show suggestion and let claimant accept or override

**Affected containers from Day 4:**

| Container | Change |
|-----------|--------|
| Claims API | New endpoint + 3 new internal components |
| Blob Storage | Existing `receipts` container read by new endpoint |
| Azure SQL | New columns on `receipts` table: `suggested_category`, `confidence`, `category_source` |
| Web App | New suggestion UI card — no backend change |
| App Insights | New custom event `categoriser.suggested` |

**Not affected:**
- Service Bus
- Notification Worker
- Export Worker
- Audit Store schema
- Identity / Entra ID

---

## 3. Contract

### Endpoint

```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Inputs

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `claimId` | UUID (path) | Yes | Must exist; caller must be the claimant |
| `receiptBlobKey` | string (body) | Yes | Must be in `receipts` container (virus scan passed); max 500 chars |

**Example request:**
```json
{
  "receiptBlobKey": "receipts/claim-abc123/receipt-001.jpg"
}
```

**Input rules:**
- Caller JWT `memberId` must match `claimantId` on the claim
- File must be in `receipts` container — not `quarantine`
- Supported file types: JPEG, PNG only (PDF deferred to v2)
- Max file size: 10 MB (enforced at upload per ADR-0004)
- Feature flag must be `true` — returns 404 if off

### Outputs

**HTTP 200 OK:**
```json
{
  "category": "Meals",
  "confidence": 0.87,
  "source": "llm",
  "needsReview": false
}
```

| Field | Type | Values |
|-------|------|--------|
| `category` | string enum | `Meals` `Travel` `Lodging` `Office Supplies` `Other` |
| `confidence` | float | 0.0 – 1.0 |
| `source` | string enum | `llm` `rule-based` |
| `needsReview` | boolean | `true` when confidence < 0.6 |

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_BLOB_KEY` | `receiptBlobKey` missing or malformed |
| 400 | `UNSUPPORTED_FILE_TYPE` | File is PDF or unsupported format |
| 401 | `UNAUTHORIZED` | JWT missing or expired |
| 403 | `NOT_CLAIM_OWNER` | Caller is not the claimant |
| 404 | `CLAIM_NOT_FOUND` | `claimId` does not exist |
| 404 | `FEATURE_DISABLED` | Feature flag is off |
| 413 | `FILE_TOO_LARGE` | Receipt exceeds 10 MB |
| 422 | `RECEIPT_IN_QUARANTINE` | File not yet virus-scanned |
| 422 | `CLAIM_TERMINAL_STATE` | Claim already Approved or Rejected |
| 502 | `UPSTREAM_UNAVAILABLE` | Both LLM and rule-based failed (should not occur) |

### Side Effects

**Application Insights customEvent emitted within 5 seconds:**
```json
{
  "name": "categoriser.suggested",
  "properties": {
    "claimId": "abc-123",
    "receiptBlobKey": "receipts/claim-abc123/receipt-001.jpg",
    "category": "Meals",
    "confidence": 0.87,
    "source": "llm",
    "needsReview": false,
    "overriddenBy": null
  }
}
```

**PII rules (from Day 3 observability plan):**
- `memberId` — NOT included in the event
- `displayName` — never logged
- Receipt line item text — never logged
- Vendor names — never logged
- Card numbers — never logged

**Azure SQL write:**
- Updates `suggested_category`, `confidence`, `category_source` on the `receipts` row

**No audit log row written:**
- Audit log is for claim state transitions only (per ADR-0005)
- Categorisation is not a state transition

### Internal Processing Flow

```
1. Validate JWT → extract memberId
2. Check feature flag → 404 if disabled
3. Load claim from DB → 404 if missing, 403 if not owner
4. Check claim not in terminal state → 422 if Approved/Rejected
5. Check blob in `receipts` container → 422 if still in quarantine
6. Call Document Intelligence OCR (timeout: 3 s)
   → fail → skip to step 8a (empty text)
7. Call Azure OpenAI gpt-4.1 (timeout: 3 s)
   → fail (5xx/timeout) → go to step 8b (rule-based)
   → success → go to step 9
8a. OCR failed → category="Other", confidence=0.0, source="rule-based"
8b. LLM failed → run rule-based categoriser on OCR text
9.  Set needsReview = (confidence < 0.6)
10. Write result to Azure SQL
11. Emit categoriser.suggested customEvent
12. Return 200 { category, confidence, source, needsReview }
```

---

## 4. Acceptance Criteria

See: `sanula-day5-receipt-categoriser-acceptance.md`

**Summary:**

| ID | Scenario |
|----|----------|
| AC-01 | Clear meal receipt → "Meals", confidence ≥ 0.7, source "llm" |
| AC-02 | Ambiguous mixed receipt → needsReview = true |
| AC-03 | LLM returns 503 → source "rule-based", confidence ≤ 0.5 |
| AC-04 | OCR completely fails → category "Other", confidence 0.0 |
| AC-05 | File > 10 MB → 413 |
| AC-06 | Receipt with customer name → PII absent from customEvent |

---

## 5. Examples

### Example 1 — Happy path: clear restaurant receipt

**Input:**
```json
{ "receiptBlobKey": "receipts/claim-abc/receipt-001.jpg" }
```

OCR text: `McDonald's Colombo 03 — Burger Meal x2 — Total LKR 2,400`

**Output:**
```json
{ "category": "Meals", "confidence": 0.91, "source": "llm", "needsReview": false }
```

---

### Example 2 — Ambiguous: mixed food and stationery

**Input:**
```json
{ "receiptBlobKey": "receipts/claim-def/receipt-002.png" }
```

OCR text: `Keells Super — Lunch pack LKR 350, Pen x2 LKR 120 — Total LKR 470`

**Output:**
```json
{ "category": "Office Supplies", "confidence": 0.48, "source": "llm", "needsReview": true }
```
- `needsReview: true` because confidence < 0.6
- UI shows: "Needs review — please confirm or change this category"

---

### Example 3 — LLM unavailable (503 from Azure OpenAI)

**Input:**
```json
{ "receiptBlobKey": "receipts/claim-ghi/receipt-003.jpg" }
```

OCR text: `Uber Sri Lanka — Trip fare LKR 850`
Azure OpenAI → 503

**Output:**
```json
{ "category": "Travel", "confidence": 0.40, "source": "rule-based", "needsReview": true }
```
- Rule-based matched keyword "Uber" → Travel
- Confidence capped at 0.5 for all rule-based results
- Response is still 200 — caller does not see upstream failure

---

### Example 4 — OCR completely fails

**Input:**
```json
{ "receiptBlobKey": "receipts/claim-jkl/receipt-004.jpg" }
```

Azure Document Intelligence → 503

**Output:**
```json
{ "category": "Other", "confidence": 0.0, "source": "rule-based", "needsReview": true }
```
- No text to analyse → default to "Other"
- UI shows: "We couldn't read this receipt — please select a category manually"

---

### Example 5 — Oversized file

**Input:** `receiptBlobKey` pointing to a 12 MB file

**Output:**
```json
HTTP 413
{ "code": "FILE_TOO_LARGE", "message": "Receipt file exceeds the 10 MB limit." }
```

---

## 6. Out of Scope

The following could reasonably be in scope but are explicitly excluded from v1:

- **PDF receipts** — increases latency beyond 4 s p95; returns 400 `UNSUPPORTED_FILE_TYPE`
- **Batch categorisation** — one receipt per call only; batch is a separate feature (Day 4 README)
- **Active learning from overrides** — overrides logged for future analysis only; no retraining in v1
- **Auto-submission without claimant confirmation** — categoriser suggests only; claimant must confirm
- **Categorising receipts on terminal claims** — Approved or Rejected claims return 422
- **Multi-currency parsing** — reads text only; no currency conversion (Day 4 README excludes this)
- **Admin UI for rule mapping** — rule-based keyword list is hardcoded in v1; config UI deferred

---

## 7. Open Questions

| # | Question | Owner | Impact if unresolved |
|---|----------|-------|----------------------|
| OQ-1 | Should 0.6 confidence threshold be global or configurable per category? | Product + Finance | Changes `needsReview` logic |
| OQ-2 | Can `memberId` appear in `categoriser.suggested` event for model evaluation? | Privacy team | Changes customEvent payload |
| OQ-3 | Who owns and maintains the rule-based keyword list — Engineering or Finance? | Product | Determines if admin UI stays out of scope |
| OQ-4 | Does LKR 5 cost cap include Document Intelligence costs or LLM costs only? | Finance + Engineering | May require model or prompt change |
| OQ-5 | Should categorisation trigger automatically on upload (Event Grid) or only on explicit API call? | Product | Major scope change if automatic |
| OQ-6 | If feature flag toggled OFF mid-request, does in-flight request complete or return 404? | Engineering | Edge case — needs explicit decision |

---

## Appendix — Day 4 Architecture Fit

```
Web App (React SPA — Day 4)
  │
  │  POST /claims/{id}/receipts/categorise
  ▼
Claims API — Azure App Service P2v3 (Day 4)
  ├── Auth Middleware               existing — no change
  ├── [NEW] Categoriser Controller
  │     ├── Feature flag check  →  Azure App Configuration
  │     ├── [NEW] LLM Categoriser
  │     │     ├──→ Azure Document Intelligence (OCR)
  │     │     └──→ Azure OpenAI gpt-4.1
  │     └── [NEW] Rule-Based Categoriser (fallback)
  └── App Insights                  existing — new event added

Rules:
- All calls stay within BISTEC Azure tenant
- Receipt image bytes → Document Intelligence only
- Only extracted text → Azure OpenAI (no raw image to LLM)
- No PII leaves the tenant
```
