# BookSwap — SLI/SLO Map

## 1. NFR Inventory

| # | NFR (from Day 2 / Day 3) | User-visible behaviour |
|---|--------------------------|------------------------|
| 1 | Catalogue search: 99% of requests under 800 ms over 28 days | Member searches for a book and gets results quickly — slow search means they give up |
| 2 | Listing creation: 99.9% success rate; failed attempts retryable without duplicates | Member lists a book — failure means their book never appears in the catalogue |
| 3 | Authentication: every endpoint except /health requires a valid JWT, tokens expire in 1 hour | Member cannot access any data without logging in; stale sessions are rejected |
| 4 | Detection: complete outage of listings endpoint must page on-call within 3 minutes | Operations team knows about failures before members report them |
| 5 | Audit: every auth failure and loan creation/return logged with request ID and member ID | Compliance and security team can trace any suspicious activity |
| 6 | System must keep accepting new listings during 10× RPS spike sustained 4 hours | During tabloid spike, members can still list and browse books |
| 7 | A member must never see another member's loan history or address | Privacy — cross-member data leaks are a trust and legal risk |

---

## 2. SLI / SLO Table

| # | SLI definition | Measurement source | SLO target | Window | Error budget |
|---|---------------|-------------------|------------|--------|--------------|
| 1 | % of GET /books requests that return 2xx in under 800 ms | Application Insights `requests` table — `duration < 800 and success == true` | ≥ 99% | Rolling 28 days | 1% = ~8 hours of bad requests per month |
| 2 | % of POST /books requests that return 2xx or 4xx (not 5xx) | Application Insights `requests` table — `resultCode != 5xx` | ≥ 99.9% | Rolling 28 days | 0.1% = ~43 minutes of failures per month |
| 3 | % of protected endpoint requests that correctly return 401 when JWT is missing or expired | Application Insights custom events — `auth.failed` vs `auth.missing_token` | 100% — no exceptions | Per request | Zero tolerance — any gap is a security incident |
| 4 | Time from GET /books returning 0 successful responses to PagerDuty alert firing | Azure Monitor alert evaluation frequency | ≤ 3 minutes | Per incident | Zero — every outage must be detected in time |
| 5 | % of loan create/return events that appear in logs with request ID and member ID | Azure Monitor Logs — `traces` table with `customDimensions.event == "loan.created"` | 100% | Per event | Zero — missing audit log is a compliance failure |
| 6 | % of POST /books requests that succeed during 10× traffic window | Application Insights `requests` — filtered to spike window | ≥ 99.9% | 4-hour spike window | 0.1% of requests may fail during spike |
| 7 | Count of API responses where a member's loan or address data belongs to a different member | Application Insights — custom event `authz.bola_attempt` | 0 | Per request | Zero — any occurrence is a P1 security incident |

### Application Insights query for SLI 1

```kusto
requests
| where timestamp > ago(28d)
| where name == "GET /books"
| summarize
    good  = countif(success == true and duration < 800),
    total = count()
| extend sli = 100.0 * good / total
```

### Application Insights query for SLI 2

```kusto
requests
| where timestamp > ago(28d)
| where name == "POST /books"
| summarize
    good  = countif(toint(resultCode) < 500),
    total = count()
| extend sli = 100.0 * good / total
```

---

## 3. Error Budget Policy

### When is the budget exhausted?

| SLO | Budget exhausted when |
|-----|----------------------|
| Search latency (SLI 1) | More than 8 hours of slow/failed requests consumed in the current 28-day window |
| Listing creation (SLI 2) | More than 43 minutes of 5xx responses consumed in the current 28-day window |

### What the team stops doing

1. **All non-critical feature work stops.** No new endpoints, no schema changes, no dependency upgrades until the SLO is restored.
2. **On-call engineer is assigned full-time to reliability work** — not split with feature tasks.
3. **Deployments are frozen** except for hotfixes that directly address the SLO breach.
4. **A blameless post-mortem is mandatory** within 48 hours of the budget being exhausted.

### Who owns the decision

The **on-call engineer** declares budget exhaustion and freezes deployments.
The **engineering lead** approves any exception to the freeze.
The **product manager** is notified within 30 minutes of a freeze being declared.

---

## 4. Out of Budget Right Now

**SLI 6 — listing creation success rate during 10× traffic spike** is the one most likely to fail today.

The current design runs on a single Azure App Service plan with no autoscale rules configured. At 10× normal RPS sustained for 4 hours, the Express process will exhaust its connection pool to Azure SQL and begin returning 503s — breaking the 99.9% listing creation SLO long before the 4-hour window ends. The queue absorbs email work but cannot protect the API process itself from being overwhelmed.
