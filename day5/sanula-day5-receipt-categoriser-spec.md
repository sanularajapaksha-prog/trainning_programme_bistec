# Receipt Categoriser — Feature Spec v0.1

**Author:** Sanula  
**Date:** 2026-05-17  
**Status:** Draft  
**Affects:** GreenChit Claims API (Day 4 design)

---

## 1. Why

### The Problem

BISTEC Finance staff manually categorise every expense receipt when reviewing
reimbursement claims. With approximately 2,000 claims per month, this is
repetitive, error-prone, and slows down the approval cycle. Mis-categorised
claims require back-and-forth between the claimant and the finance reviewer,
adding 1–2 extra days to the average reimbursement cycle.

### The Outcome We Are Solving

A claimant uploads a receipt and immediately sees a suggested expense category
with a confidence score. They confirm or correct the suggestion in one tap
before submitting. Finance reviewers see pre-categorised claims and spend
significantly less time on manual rework.

### The Metric This Feature Is Expected to Move

- **Primary:** Average time from claim submission to finance approval reduced
  by ≥ 20% within 60 days of launch (measured in Azure SQL as
  `approved_at - submitted_at` per claim).
- **Secondary:** Rate of claims returned to claimant for recategorisation
  drops from current baseline to < 5% of submitted claims.

---

## 2. Scope

### In Scope

- A new endpoint `POST /claims/{claimId}/receipts/categorise` inside the
  existing **GreenChit Claims API** (Node.js / Express, Azure App Service P2v3).
- OCR of the uploaded receipt image using **Azure AI Document Intelligence**
  (within the BISTEC Azure tenant).
- Category suggestion using **Azure OpenAI Service gpt-4.1** (BISTEC tenant
  deployment — not public OpenAI endpoint).
- Rule-based fallback categoriser that runs when Azure OpenAI is unavailable.
- A feature flag in **Azure App Configuration** that enables or disables the
  categoriser without a redeployment.
- Logging of every suggestion (accepted or overridden) as an Application
  Insights `customEvent` named `categoriser.suggested`.
- UI affordance in the **Web App** (React SPA) to display the suggestion and
  allow the claimant to accept or change it before submitting the claim.

### Affected Containers from Day 4

| Container | Change |
|-----------|--------|
| **Claims API** | New endpoint, new internal components (Categoriser Controller, LLM Categoriser, Rule-Based Categoriser) |
| **Blob Storage** | Existing `receipts` container read by the new endpoint via SAS read URL |
| **Database (Azure SQL)** | New column `suggested_category` and `category_source` on the `receipts` table; new `categoriser_log` table |
| **Identity (Entra ID)** | No change — existing JWT auth applies to the new endpoint |
| **Web App** | New suggestion UI component; no backend change |

### Not Affected

- Service Bus, Notification Worker, Export Worker, Audit Store schema — no
  changes required.

---

## 3. Contract

### Endpoint

```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Inputs

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `claimId` | UUID (path parameter) | Yes | Must be an existing claim owned by the caller |
| `receiptBlobKey` | string (body) | Yes | Blob key of an already-uploaded receipt in the `receipts` container. Max 500 chars. |

**Request body example:**
```json
{
  "receiptBlobKey": "receipts/claim-abc123/receipt-001.jpg"
}
```

**Constraints:**
- The caller's JWT `memberId` must match the `claimantId` on the claim.
- The receipt file must already be in the `receipts` container (virus scan
  passed). Files still in `quarantine` are rejected with 422.
- File must be JPEG or PNG (PDF receipts are not supported in v1 — see
  Out of Scope). Maximum file size 10 MB (enforced at upload time per ADR-0004).
- Feature flag `greenchit.categoriser.enabled` must be `true` in Azure App
  Configuration. If false, endpoint returns 404.

### Outputs

**HTTP 200 OK**
```json
{
  "category": "Meals",
  "confidence": 0.87,
  "source": "llm",
  "needsReview": false
}
```

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `category` | string enum | `Meals`, `Travel`, `Lodging`, `Office Supplies`, `Other` | Always present |
| `confidence` | float | 0.0 – 1.0 | Always present |
| `source` | string enum | `llm`, `rule-based` | `rule-based` when LLM unavailable or OCR fails |
| `needsReview` | boolean | true / false | `true` when `confidence < 0.6` |

### Errors

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `INVALID_BLOB_KEY` | `receiptBlobKey` is missing or malformed |
| 401 | `UNAUTHORIZED` | JWT missing or expired |
| 403 | `NOT_CLAIM_OWNER` | Caller is not the claimant on this claim |
| 404 | `CLAIM_NOT_FOUND` | `claimId` does not exist |
| 404 | `FEATURE_DISABLED` | Feature flag is off |
| 413 | `FILE_TOO_LARGE` | Receipt file exceeds 10 MB |
| 422 | `RECEIPT_IN_QUARANTINE` | File has not passed virus scan yet |
| 502 | `OCR_UNAVAILABLE` | Azure Document Intelligence returned 5xx or timed out after 3 s |
| 502 | `LLM_UNAVAILABLE` | Azure OpenAI returned 5xx — this should NOT happen in practice because the rule-based fallback catches it; 502 is only returned if both LLM and rule-based fail |

### Side Effects

1. **Application Insights `customEvent`** named `categoriser.suggested` emitted
   within 5 seconds of the response being sent. Event payload:

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

> **PII rule:** `memberId` is NOT included in this event. `receiptBlobKey`
> contains no personal data. No receipt text, line items, or vendor names
> are logged.

2. **Azure SQL write** — `suggested_category`, `confidence`, and `source`
   columns updated on the `receipts` row for this `receiptBlobKey`.

3. **No audit log row** is written for a categorisation suggestion — only for
   claim state transitions (existing behaviour per ADR-0005).

### Processing Flow (internal — not contractual)

```
1. Validate JWT → extract memberId
2. Check feature flag → 404 if disabled
3. Load claim from DB → 404 if not found, 403 if not owner
4. Check blob exists in `receipts` container → 422 if in quarantine
5. Call Azure Document Intelligence OCR (timeout: 3 s)
   → on failure: skip to step 7 with empty text
6. Call Azure OpenAI gpt-4.1 (timeout: 3 s)
   → on failure (5xx / timeout): go to step 7b
   → on success: go to step 8
7a. OCR text empty → set category="Other", confidence=0.0, source="rule-based"
7b. LLM unavailable → run rule-based categoriser on OCR text
8. Compute needsReview = (confidence < 0.6)
9. Write result to DB
10. Emit customEvent to Application Insights
11. Return 200 with { category, confidence, source, needsReview }
```

---

## 4. Acceptance Criteria

See `sanula-day5-receipt-categoriser-acceptance.md` for the full
Given / When / Then set (AC-01 through AC-06).

**Summary of criteria:**

| ID | Scenario |
|----|----------|
| AC-01 | Clear meal receipt → "Meals", confidence ≥ 0.7, source "llm" |
| AC-02 | Ambiguous mixed receipt → needsReview = true |
| AC-03 | LLM returns 503 → source "rule-based", confidence ≤ 0.5 |
| AC-04 | OCR completely fails → category "Other", source "rule-based" |
| AC-05 | File > 10 MB → 413 error |
| AC-06 | Receipt with customer name → PII absent from customEvent |

---

## 5. Examples

### Example 1 — Happy path: clear restaurant receipt

**Input:**
```json
POST /claims/7cb12345-0000-4abc-b3fc-abcdef123456/receipts/categorise
{
  "receiptBlobKey": "receipts/7cb12345/receipt-001.jpg"
}
```
OCR output (internal): `"McDonald's Colombo 03 — Burger Meal x2 — Total LKR 2,400"`

**Output:**
```json
HTTP 200 OK
{
  "category": "Meals",
  "confidence": 0.91,
  "source": "llm",
  "needsReview": false
}
```

**customEvent emitted:**
```json
{
  "name": "categoriser.suggested",
  "properties": {
    "claimId": "7cb12345-0000-4abc-b3fc-abcdef123456",
    "category": "Meals",
    "confidence": 0.91,
    "source": "llm",
    "needsReview": false,
    "overriddenBy": null
  }
}
```

---

### Example 2 — Ambiguous receipt: mixed food and stationery

**Input:**
```json
POST /claims/3fa85f64-5717-4562-b3fc-2c963f66afa6/receipts/categorise
{
  "receiptBlobKey": "receipts/3fa85f64/receipt-002.png"
}
```
OCR output (internal): `"Keells Super — Lunch pack x1 LKR 350, Pen x2 LKR 120 — Total LKR 470"`

**Output:**
```json
HTTP 200 OK
{
  "category": "Office Supplies",
  "confidence": 0.48,
  "source": "llm",
  "needsReview": true
}
```

Note: `needsReview: true` because `confidence < 0.6`. The claimant sees
"Needs review" in the UI and is prompted to confirm or change the suggestion.

---

### Example 3 — Error path: Azure OpenAI unavailable (503)

**Input:**
```json
POST /claims/9de12345-0000-4abc-b3fc-abcdef654321/receipts/categorise
{
  "receiptBlobKey": "receipts/9de12345/receipt-003.jpg"
}
```
Azure OpenAI returns HTTP 503.

**Output:**
```json
HTTP 200 OK
{
  "category": "Travel",
  "confidence": 0.40,
  "source": "rule-based",
  "needsReview": true
}
```

Note: The rule-based fallback analysed the OCR text and found the keyword
"Uber" → mapped to "Travel". Confidence is capped at 0.5 for all
rule-based suggestions. Response is still 200 — the caller does not see the
upstream failure.

---

### Example 4 — Error path: OCR completely fails

**Input:**
```json
POST /claims/1ab85f64-5717-4562-b3fc-2c963f66afa6/receipts/categorise
{
  "receiptBlobKey": "receipts/1ab85f64/receipt-004.jpg"
}
```
Azure Document Intelligence returns 503.

**Output:**
```json
HTTP 200 OK
{
  "category": "Other",
  "confidence": 0.0,
  "source": "rule-based",
  "needsReview": true
}
```

Note: When OCR fails, there is no text to analyse. The system returns
"Other" with confidence 0.0 and `needsReview: true`. The claimant sees:
"We couldn't read this receipt — please select a category manually."

---

### Example 5 — Error path: oversized file

**Input:**
```
POST /claims/{claimId}/receipts/categorise
receiptBlobKey pointing to a 12 MB file
```

**Output:**
```json
HTTP 413 Payload Too Large
{
  "code": "FILE_TOO_LARGE",
  "message": "Receipt file exceeds the 10 MB limit. Please upload a smaller image."
}
```

---

## 6. Out of Scope

The following items could reasonably be in scope but are explicitly excluded
from v1:

1. **PDF receipt categorisation** — Azure Document Intelligence supports PDF,
   but LLM prompting for multi-page PDFs increases latency beyond the 4 s p95
   target. PDFs return 400 with `code: UNSUPPORTED_FILE_TYPE` in v1.

2. **Batch categorisation of multiple receipts in one request** — the endpoint
   categorises one receipt per call. Batch upload is a separate feature
   (noted in the Day 4 README as out of scope for v1).

3. **Active learning / model fine-tuning from overrides** — when a claimant
   overrides the suggestion, the override is logged in Application Insights
   for future analysis but is NOT used to retrain or prompt-tune the model
   in v1.

4. **Auto-submission without claimant confirmation** — the categoriser
   suggests only. The claimant must explicitly accept or change the category
   before the claim advances. No automatic state transitions are triggered by
   this endpoint.

5. **Categorisation of receipts already attached to approved or rejected
   claims** — the endpoint returns 422 if the claim is in any terminal state
   (`Approved`, `Rejected`). Re-categorisation of closed claims is not
   supported in v1.

6. **Multi-currency parsing** — the categoriser reads line item text but
   does not parse or convert currency amounts. The Day 4 README explicitly
   excludes multi-currency for v1.

7. **Admin override of category mapping rules** — the rule-based fallback
   uses a hardcoded keyword-to-category map in v1. A configuration UI for
   finance admins to update the rules is deferred.

---

## 7. Open Questions

The following questions are genuinely open and must be resolved before
implementation begins. They are NOT closed by this spec.

| # | Question | Owner | Impact if unresolved |
|---|----------|-------|----------------------|
| OQ-1 | The NFR sets the confidence threshold for "Needs review" at 0.6. Should this threshold be configurable per category (e.g. "Travel" might need a higher bar than "Other")? | Product + Finance team | Affects the `needsReview` logic in the Categoriser Controller |
| OQ-2 | Should the claimant's category override be logged with the `memberId` in Application Insights for model evaluation purposes? The current spec excludes `memberId` from the event for privacy. Is aggregate-level logging (category + override, no member identity) sufficient? | Privacy / Finance | Affects the customEvent payload design |
| OQ-3 | The rule-based fallback uses a keyword list. Who owns and maintains this list — Engineering or Finance? If Finance owns it, we need a config mechanism (see Out of Scope item 7). | Product | Affects whether OQ-7 stays out of scope in v1 |
| OQ-4 | Azure OpenAI gpt-4.1 pricing at 2,000 requests/month must not exceed LKR 5 per request. At current Azure OpenAI token pricing, what is the expected token count per receipt OCR output? Has the Finance team confirmed the LKR 5 budget includes OCR costs (Document Intelligence) or only LLM costs? | Engineering + Finance | If cost exceeds budget, we must reduce prompt size or switch to a smaller model |
| OQ-5 | Should the categoriser run automatically when a receipt is uploaded (triggered by Blob Storage event), or only on explicit `POST /categorise` call from the client? The current spec uses explicit call. Automatic triggering would improve UX but changes the architecture (adds Event Grid). | Product + Engineering | Major scope change if automatic triggering is chosen |
| OQ-6 | What should happen if the feature flag is toggled OFF while a request is in-flight? The current spec returns 404 for all calls when the flag is off. Should in-flight requests complete normally? | Engineering | Edge case — low priority but needs a decision |

---

## Appendix: Architecture Context

This feature lives entirely within the **GreenChit Claims API** container
from Day 4. No new Azure containers are introduced. The two new external
service calls (Document Intelligence and Azure OpenAI) are outbound HTTP
calls from the Claims API process, staying within the BISTEC Azure tenant.

```
Web App
  │
  │ POST /claims/{id}/receipts/categorise
  ▼
Claims API (App Service P2v3)
  ├── Auth Middleware (existing — no change)
  ├── [NEW] Categoriser Controller
  │     ├── Feature flag check → Azure App Configuration
  │     ├── [NEW] LLM Categoriser
  │     │     ├── → Azure Document Intelligence (OCR)
  │     │     └── → Azure OpenAI gpt-4.1
  │     └── [NEW] Rule-Based Categoriser (fallback)
  ├── Audit Writer (existing — NOT called by categoriser)
  └── → Application Insights (customEvent)
```

All external calls remain within the BISTEC Azure tenant boundary.
No PII leaves the tenant. Receipt image bytes are sent to Document
Intelligence only, not to Azure OpenAI (only the extracted text is
sent to the LLM).
