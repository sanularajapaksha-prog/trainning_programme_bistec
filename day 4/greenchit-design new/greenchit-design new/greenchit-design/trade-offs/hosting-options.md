# GreenChit — Hosting Options Trade-off Table

## Options Under Review

**Option A: Azure App Service (monolith)** — single Node.js/Express web app on Azure App Service P2v3, with Azure Function Apps for notification and export workers deployed separately on a consumption plan.

**Option B: Azure Container Apps (split)** — Claims API, Notification Worker, and Export Worker each deployed as separate container revisions in a shared Azure Container Apps Environment, with KEDA-based autoscaling per revision.

---

## Scoring Method

Each quality attribute is scored 1 (very poor) to 5 (excellent) for each option. Scores reflect the **team's current context**: 10 engineers, no container deployment experience, 6-week first-release deadline, expected peak of <50 concurrent users.

---

## Trade-off Table

| Quality attribute | Option A: App Service | Option B: Container Apps | Justification |
|---|---|---|---|
| **Time-to-first-deploy** | 5 | 2 | App Service: GitHub Actions to App Service is a 1–2 day setup using existing BISTEC Azure subscription; deployment slots are portal-configurable. Container Apps: requires a working Dockerfile, Azure Container Registry push pipeline, a Container Apps Environment (Bicep or Terraform), managed identity for ACR pull, and KEDA scale rules — a 3–5 day setup for a team with no prior Container Apps experience. Under a 6-week deadline, this difference is decisive. |
| **Cost at low spend (<50 users)** | 5 | 3 | App Service P2v3 at 2 instances for HA: ~$300/month flat and predictable. Container Apps consumption pricing is theoretically cheaper at low traffic, but adds: ACR storage ($10+/month), Container Apps Environment base fee (~$30/month), and the operational risk of min-replica=0 causing cold-start violations of the 1.5 s p95 NFR — which would force min-replica=1, removing most of the cost advantage. App Service is cheaper and risk-free for this scale. |
| **Operability for 10-person team** | 4 | 2 | App Service: deployment slots, auto-restart, App Insights auto-instrumentation, and Kudu SSH access work out of the box with no container knowledge. Container Apps: the team must learn revision management, ingress rules, KEDA scaling triggers, container health probes, and sidecar configuration before they can confidently operate the system. Score improves over time as the team learns, but starts at 2 for a team with no prior exposure. |
| **Independent deploy of components** | 1 | 5 | App Service monolith: every change — including a 1-line fix to the Export Worker — triggers a full API redeployment and slot swap (3–5 minutes). If the team grows to 3 feature squads, they will be serialised on a single deployment pipeline. Container Apps: each revision (API, Notification Worker, Export Worker) is independently deployable with zero impact on other revisions. Option B decisively wins this attribute. |
| **Future scaling flexibility** | 2 | 5 | App Service scales horizontally as a unit: CPU-heavy export batch jobs force all instances to scale up, including the API. Container Apps with KEDA scales each revision independently: Export Worker can scale to 10 replicas during a batch run while API stays at 2. If GreenChit adds more background job types (payroll sync, receipt OCR), Container Apps handles them cleanly without bloating the API process. |
| **Authn/authz consistency** | 4 | 3 | Monolith: one Auth Middleware instance, one JWT configuration, one JWKS endpoint cache — no coordination needed. Container Apps split: each service validates JWTs independently; a misconfigured audience claim or JWKS endpoint URL in one service causes silent auth failures that are hard to debug across revision boundaries. Requires careful IaC templating and integration testing across all revisions. |
| **Total** | **21** | **20** | — |

---

## Decision-Driving Attributes

The two attributes that drove the final decision in favour of Option A are:

1. **Time-to-first-deploy (A=5 vs B=2):** The 6-week deadline is a hard constraint. Spending the first two weeks on container infrastructure instead of claim lifecycle features would leave 4 weeks for application development — an unacceptable risk for a first internal release.

2. **Operability for a 10-person team (A=4 vs B=2):** The team has no container deployment experience. The operational incidents most likely to occur (failed deploy, memory leak, traffic spike) are all easier to diagnose and recover from in App Service than in Container Apps for an inexperienced team.

Independent deploy (B=5 vs A=1) is the one attribute where Option B decisively wins, but it is not a pain point at v1. With one team, serialised deploys via a slot swap are not a bottleneck. This attribute will become decision-driving when the team grows to 3+ feature squads — at which point ADR-0002 should be reopened.

---

## What this decision does NOT do

This scoring does not imply Option B is wrong in general. For a team with container experience, Option B is the better long-term architecture. The scores reflect this team, this deadline, and this traffic level — not an abstract comparison.
