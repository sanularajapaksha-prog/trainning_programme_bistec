# GreenChit Design Pack

BISTEC internal reimbursement tool — architecture design artefacts for Day 4.

**Author:** Sanula  
**Date:** 2026-05-13

## Repository Structure

```
greenchit-design/
├── README.md                          ← this file
├── sanula-day4-greenchit-design.md    ← main design pack (containers + components)
├── sanula-day4-trade-offs-and-review.md ← trade-off table + design review
├── diagrams/
│   ├── container-diagram.svg          ← C4 Level 2
│   ├── component-diagram.svg          ← C4 Level 3 (Claims API)
│   └── sequence-submit-approve.md     ← Mermaid sequence (happy path + 2 error paths)
├── adrs/
│   ├── 0001-record-architecture-decisions.md
│   ├── 0002-hosting-platform.md
│   ├── 0003-database-choice.md
│   ├── 0004-receipts-storage-and-virus-scan.md
│   └── 0005-audit-log-tamper-evidence.md
└── trade-offs/
    └── hosting-options.md             ← detailed scoring table with justifications
```

## Recommended Reading Order

1. **`sanula-day4-greenchit-design.md`** — start here; Section 1 (context) + Section 2 (container diagram) gives the full picture in 5 minutes
2. **`diagrams/sequence-submit-approve.md`** — see the happy path and two error paths end-to-end
3. **`adrs/`** — read in order; each ADR is self-contained and references the others
4. **`sanula-day4-trade-offs-and-review.md`** — trade-off scoring and design review feedback

## What This Design Will NOT Do in v1

GreenChit v1 will not support: multi-currency claims, mobile native apps (web app only), bulk claim submission, payroll system direct API integration (CSV drop to SharePoint only), delegated approval (claims must be approved by the direct line manager only), and integration with BISTEC's HR system for automatic line-manager lookup (managers are set manually in user profiles at launch).
