# GreenChit — Trade-offs and Design Review

## Setup

Two architectural options for GreenChit were evaluated:

- **Option A: Azure App Service monolith** — a single Node.js/Express web app on App Service (P2v3) with Azure Function Apps for notification and export workers
- **Option B: Azure Container Apps split** — the Claims API, Notification Worker, and Export Worker each deployed as separate container revisions in Azure Container Apps, with KEDA-based autoscaling

Quality attributes were weighted by two business priorities: (1) shipping a working internal release in 6 weeks, and (2) operability for a 10-person team that has no container deployment experience.

Scoring: 1 (very poor) to 5 (excellent) for each option per attribute.

---

## Trade-off Table

| Quality attribute | Option A: App Service monolith | Option B: Container Apps split | Why |
|---|---|---|---|
| **Time-to-first-deploy** | **5** | **2** | App Service deploy via GitHub Actions takes 1–2 days with existing BISTEC Azure setup. Container Apps requires a working Dockerfile, ACR push pipeline, and Container Apps Environment (Bicep or portal) before the first request can land — a 3–5 day setup cost for a team new to containers. |
| **Cost at low spend** | **5** | **3** | P2v3 App Service (2 vCores, 8 GB RAM) costs ~$150/month; 2 instances for HA = ~$300. Container Apps on consumption pricing at ~50 requests/hour is very cheap but adds ACR storage, Container Apps Environment overhead, and the risk of misconfigured min-replica=0 causing cold-start failures that violate the 1.5 s p95 NFR. App Service has predictable flat cost. |
| **Operability for 10-person team** | **4** | **2** | App Service deployment slots, auto-restart, and App Insights auto-instrumentation require no container knowledge. Container Apps requires the team to understand revision management, KEDA scaling rules, sidecar injection, and container health probes. The team has no prior Container Apps experience; operability would improve over time but starts low. |
| **Independent deploy of components** | **1** | **5** | In the monolith, every change (even a one-line fix to the Export Worker) triggers a full API redeployment with a slot swap. Container Apps allows the Notification Worker revision to be updated independently, with zero impact on the Claims API. This attribute strongly favours Option B. |
| **Future scaling flexibility** | **2** | **5** | App Service scales horizontally as a unit: if the export job is CPU-intensive during a batch run, all instances scale up, not just the export path. Container Apps with KEDA can scale the Export Worker to 10 replicas while leaving the Claims API at 2. This is the correct architecture for a system that may add more background job types over time. |
| **Authn/authz consistency** | **4** | **3** | In the monolith, one Auth Middleware instance handles all routes with one JWT validation configuration. In Container Apps, each service validates JWTs independently; mismatches in JWKS endpoint config, token expiry tolerance, or audience claim between services are a real risk that requires careful IaC templating. |
| **Total** | **21** | **20** |  |

---

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Quality attributes scored | 6 | 6 |
| Cells with a written justification | 12 | 12 |
| Decision-affecting attributes identified | 2–3 | 3 (time-to-deploy, operability, independent deploy) |

---

## Decision and Rationale

**Option A (App Service monolith) is chosen for v1.**

The two attributes that drove the decision are **time-to-first-deploy** (A=5, B=2) and **operability for a 10-person team** (A=4, B=2). Together they reflect the single biggest constraint: this team has a 6-week deadline and no container deployment experience. Choosing Container Apps would be the right long-term architecture but the wrong short-term call — it would consume the first two weeks in infrastructure setup and leave four weeks to build the actual application.

The one attribute where Option B decisively wins — independent deploy (B=5, A=1) — is not a pain point at v1. With one team working on one service, deploying the whole API takes 3 minutes via a slot swap; the lack of independent deploy is not a blocker until the team splits into feature squads.

The commitment is recorded explicitly in ADR-0002: we revisit the Container Apps migration when the team reaches 15 engineers or sustained RPS exceeds 200.

---

## Design Review Feedback (received from another pair)

### 3 Strengths
1. **ADR-0003 (database choice) is exceptionally well-reasoned** — the team correctly identified that row-level security at the DB layer is a stronger privacy control than application-level enforcement, and they named the exact NFR it satisfies. Most pairs chose one storage engine without explaining *why* the alternative failed.
2. **The sequence diagram error paths are specific and testable** — the upload failure path shows the exact status transition (Submitted → Draft) and the exact API response shape, which means a developer can write a failing test from the diagram before touching any code.
3. **The trade-off table decision rationale names the two winning attributes explicitly** rather than declaring the highest-total option the winner. This is the right use of a scoring table.

### 3 Weaknesses / Risks
1. **The audit log hash chain is not cryptographically linked** (acknowledged in ADR-0005 consequences) — for a "tamper-evident" claim, an adversary with DB access can replace a row and recompute the SHA-256 hash. The design should either commit to WORM Blob for primary storage or add a linked hash chain where each row hashes the previous row's hash.
2. **The Notification Worker has no dead-letter handling described** — if the Teams webhook returns 429 or 503 repeatedly, what happens to the message after 5 retries? The Service Bus DLQ is mentioned in the container table but there is no runbook or alert for DLQ depth > 0 for claim-related messages.
3. **The 15-minute SAS URL window for receipt uploads is too short for a user on intermittent Wi-Fi** — the NFR explicitly calls out intermittent connectivity. A user who loses connection for 10 minutes mid-upload has 5 minutes left on their SAS URL; if the upload resumes after 15 minutes, they get a 403. The design should extend the window to 60 minutes or add a "refresh SAS URL" endpoint.

### 2 Actionable Improvements
1. **`adrs/0004-receipts-storage-and-virus-scan.md`, Consequences section** — add a specific SAS URL expiry time and justify it against the intermittent-Wi-Fi NFR. Either extend to 60 minutes (low risk — SAS URLs are scoped to a single blob key) or add a `POST /claims/{id}/receipt-urls/refresh` endpoint that re-issues URLs for blobs still in the quarantine container.
2. **`diagrams/sequence-submit-approve.md`, happy path** — add a Service Bus DLQ arrow after the `SB-->>NW` message with an `alt [delivery fails after 5 retries]` fragment showing the message moving to the DLQ and an alert firing. This makes the async failure mode visible in the primary design artefact.

---

## Design Review Feedback (given to another pair)

*(Pair: reviewing the GreenChit pack from Kasun & Dilini)*

### 3 Strengths
1. **Container diagram arrows are consistently verb-led** ("validates JWT via", "stores receipt to", "publishes event to") — this immediately tells a reader what the relationship does, not just that it exists. The BookSwap diagram uses the same convention and it pays off in review.
2. **ADR-0002 (hosting) correctly references the trade-off table** — the decision says "App Service wins on time-to-first-deploy" and the table row for that attribute shows exactly why. The loop between the ADR and the table is closed.
3. **The sequence diagram separates synchronous solid arrows from async dashed arrows** — this is the most common gap in sequence diagrams produced under time pressure, and the pair got it right.

### 3 Weaknesses / Risks
1. **ADR-0003 does not address the audit log separately from general application data** — the pair chose Azure SQL (correct) but did not distinguish between the audit schema and the application schema. The tamper-evidence NFR requires INSERT-only permissions on the audit table; this needs to be an explicit decision, not implied by "we use SQL."
2. **The component diagram shows only 4 components** (auth, claims, receipts, export) — the brief requires at least 5, and the audit writer and notification publisher are separate components with different trust boundaries; they should appear at Level 3.
3. **The trade-off table has scores but no written justification for 4 of the 12 cells** — scores without justification are opinions; justifications are arguments. The "Cost at low spend" and "Authn/authz consistency" rows have numeric scores but no sentence explaining the reasoning.

### 2 Actionable Improvements
1. **`adrs/0003-database-choice.md`** — add a paragraph explicitly describing the INSERT-only audit user pattern and how it satisfies the tamper-evidence NFR. One paragraph is enough; it does not need to be a separate ADR if the database ADR is where a reviewer will look for audit storage decisions.
2. **`trade-offs/hosting-options.md`** — for each cell that currently has only a score, add one sentence of justification (e.g. "Container Apps requires ACR, Bicep environment, and KEDA config — 3–5 days of setup for a team new to containers"). The total word count increase is small but the argumentative value is large.
