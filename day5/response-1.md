# Receipt Categoriser — Acceptance Criteria

**Author:** Sanula  
**Date:** 2026-05-17  
**Version:** v0.1  
**Linked spec:** sanula-day5-receipt-categoriser-spec.md

---

## AC-01 — Happy path: clear meal receipt

**Given** a valid JPEG receipt of a restaurant bill totalling LKR 2,400  
**And** the receipt is in the `receipts` Blob container (virus scan passed)  
**And** the feature flag `greenchit.categoriser.enabled` is ON  
**And** Azure OpenAI and Document Intelligence are both available  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-abc/receipt-001.jpg" }
```

**Then** the response is `200 OK` with:
```json
{
  "category": "Meals",
  "confidence": >= 0.7,
  "source": "llm",
  "needsReview": false
}
```
**And** a `categoriser.suggested` customEvent is emitted in Application Insights within 5 seconds  
**And** the event contains `"category": "Meals"` and `"source": "llm"`  

---

## AC-02 — Ambiguous receipt: mixed items

**Given** a PNG receipt from a supermarket with mixed items — food (LKR 350) and stationery (LKR 120)  
**And** the receipt is in the `receipts` Blob container (virus scan passed)  
**And** Azure OpenAI and Document Intelligence are both available  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-def/receipt-002.png" }
```

**Then** the response is `200 OK`  
**And** `confidence` is between `0.0` and `0.59`  
**And** `needsReview` is `true`  
**And** `category` is one of `Meals`, `Office Supplies`, `Travel`, `Lodging`, `Other`  
**And** `source` is `"llm"`  

---

## AC-03 — LLM unavailable: fallback to rule-based

**Given** Azure OpenAI is returning `503 Service Unavailable`  
**And** a valid JPEG receipt is in the `receipts` Blob container  
**And** Azure Document Intelligence is available and returns OCR text successfully  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-ghi/receipt-003.jpg" }
```

**Then** the response is `200 OK` — NOT a 502 or 503  
**And** `source` is `"rule-based"`  
**And** `confidence` is `<= 0.5`  
**And** `needsReview` is `true`  
**And** a `categoriser.suggested` customEvent is emitted with `"source": "rule-based"`  

---

## AC-04 — OCR failure: Document Intelligence unavailable

**Given** Azure Document Intelligence is returning `503 Service Unavailable`  
**And** a valid JPEG receipt is in the `receipts` Blob container  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-jkl/receipt-004.jpg" }
```

**Then** the response is `200 OK` — NOT a 502 or 503  
**And** `category` is `"Other"`  
**And** `confidence` is `0.0`  
**And** `source` is `"rule-based"`  
**And** `needsReview` is `true`  

---

## AC-05 — Input error: oversized file

**Given** the `receiptBlobKey` points to a file of 12 MB  
**And** the 10 MB limit is defined in ADR-0004  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-mno/receipt-large.jpg" }
```

**Then** the response is `413 Payload Too Large`  
**And** the response body is:
```json
{ "code": "FILE_TOO_LARGE", "message": "Receipt file exceeds the 10 MB limit." }
```
**And** NO `categoriser.suggested` customEvent is emitted  
**And** NO write is made to Azure SQL  

---

## AC-06 — PII boundary: customer name and card number on receipt

**Given** a receipt image containing customer name "Kasun Perera" and card last 4 digits "4242"  
**And** the receipt is in the `receipts` Blob container (virus scan passed)  
**And** Azure OpenAI and Document Intelligence are both available  

**When** the claimant sends:
```
POST /claims/{claimId}/receipts/categorise
Authorization: Bearer <valid-JWT>
{ "receiptBlobKey": "receipts/claim-pqr/receipt-005.jpg" }
```

**Then** the response is `200 OK` with a valid category suggestion  
**And** the `categoriser.suggested` customEvent does NOT contain:
- Customer name "Kasun Perera"
- Any credit card digits
- Any raw OCR text or line items
- `memberId` of the claimant  
**And** the event contains only: `claimId`, `receiptBlobKey`, `category`, `confidence`, `source`, `needsReview`, `overriddenBy`  

---

## Summary

| ID | Type | Scenario | Expected status |
|----|------|----------|-----------------|
| AC-01 | Happy path | Clear meal receipt | 200 — Meals, confidence ≥ 0.7 |
| AC-02 | Ambiguous | Mixed items receipt | 200 — needsReview = true |
| AC-03 | Fallback | LLM returns 503 | 200 — source = rule-based |
| AC-04 | Fallback | OCR returns 503 | 200 — Other, confidence 0.0 |
| AC-05 | Input error | File > 10 MB | 413 |
| AC-06 | PII boundary | Customer name + card on receipt | 200 — no PII in event |
