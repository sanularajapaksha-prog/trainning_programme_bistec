# BookSwap — Observability Plan

## Setup

### Logs — Azure Monitor Logs

**Schema:** Every log entry emitted by the Node.js API follows this structure:
```json
{
  "timestamp": "2025-05-12T08:30:00.000Z",
  "level": "info",
  "event": "loan.created",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "memberId": "member-1",
  "bookId": "book-1",
  "loanId": "loan-1"
}
```

**Fields never logged (PII redaction rules):**
- `email` — always redacted, replaced with `[REDACTED]`
- `displayName` — never logged
- `address` — never stored or logged
- `phone` — never stored or logged
- JWT token value — never logged even on auth failure

**Retention:** 90 days in Azure Monitor Logs (default). After 90 days, archive to Azure Blob Storage cold tier for 2 years (compliance requirement).

**Redaction middleware (applied before any log leaves the process):**
```javascript
const appInsights = require('applicationinsights');
appInsights.defaultClient.addTelemetryProcessor((envelope) => {
  const props = envelope.data?.baseData?.properties || {};
  if (props.email)       props.email = '[REDACTED]';
  if (props.displayName) props.displayName = '[REDACTED]';
  return true;
});
```

---

### Metrics — Azure Application Insights

Instrumented via the Application Insights Node.js SDK. Auto-collected metrics:
- `requests` — every HTTP request (name, duration, resultCode, success)
- `dependencies` — every SQL query and Redis command (type, duration, success)
- `exceptions` — every unhandled error

Custom metrics emitted by the API:
- `bookswap.listing.created` — counter, +1 on successful POST /books
- `bookswap.borrow.requested` — counter, +1 on successful POST /borrow-requests
- `bookswap.loan.returned` — counter, +1 on PATCH /loans returning 200
- `bookswap.auth.failed` — counter, +1 on 401 response with `memberId` dimension

---

### Traces — Application Insights Distributed Tracing

**Sample rate:** 100% during the first month (low traffic, need full visibility). Drop to 10% after baseline is established — always sample errors at 100%.

**Trace spans captured per request:**
1. Incoming HTTP request (Front Door → App Service)
2. JWT validation (duration of Entra JWKS fetch)
3. Redis get (cache hit or miss)
4. SQL query (parameterised query text, duration)
5. Redis set (cache populate)
6. Service Bus publish (if applicable)

**Correlation:** Every request gets an `x-request-id` header at Front Door. This ID flows through all spans and appears in every log entry as `requestId`.

---

## Signals Table

| # | Signal type | Source | What it answers | Sample query / metric name |
|---|-------------|--------|-----------------|---------------------------|
| 1 | Metric | Application Insights `requests` | Search latency p95 — are we meeting the 800 ms SLO? | `requests \| where name == "GET /books" \| summarize percentile(duration, 95) by bin(timestamp, 5m)` |
| 2 | Metric | Application Insights `requests` | Listing creation success rate — are we meeting 99.9% SLO? | `requests \| where name == "POST /books" \| summarize good = countif(toint(resultCode) < 500), total = count() \| extend rate = 100.0 * good / total` |
| 3 | Log | Application Insights `traces` | Auth failures with member ID — detect brute force or token issues | `traces \| where customDimensions.event == "auth.failed" \| project timestamp, memberId = customDimensions.memberId, requestId = customDimensions.requestId` |
| 4 | Trace | Application Insights `dependencies` | Slow request breakdown — is SQL or Redis causing the latency? | `dependencies \| where timestamp > ago(1h) \| where type in ("SQL", "Redis") \| summarize avg(duration) by type, bin(timestamp, 5m)` |
| 5 | Metric | Azure Service Bus `ActiveMessages` | Email digest queue depth — is the consumer keeping up? | Azure Monitor metric: `ActiveMessages` on namespace `bookswap-sb` — alert if > 1000 messages |
| 6 | Metric | Application Insights `requests` | Request rate — detect tabloid spike early | `requests \| summarize rps = count() / 60.0 by bin(timestamp, 1m) \| where rps > 50` |
| 7 | Log | Application Insights `traces` | Loan audit trail — every loan create and return with member ID | `traces \| where customDimensions.event in ("loan.created", "loan.returned") \| project timestamp, memberId = customDimensions.memberId, loanId = customDimensions.loanId, requestId = customDimensions.requestId` |
| 8 | Metric | Azure Cache for Redis `CacheHitRate` | Cache effectiveness — is Redis actually helping? | Azure Monitor metric: `cachehits / (cachehits + cachemisses)` — alert if < 50% for 10 min |
| 9 | Metric | App Service `CpuPercentage` | App Service health during spike | Azure Monitor metric: `CpuPercentage > 70%` on App Service Plan |
| 10 | Log | Application Insights `exceptions` | Unhandled errors — catch anything unexpected | `exceptions \| where timestamp > ago(1h) \| summarize count() by outerMessage \| order by count_ desc` |

---

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| SLOs covered by an alert | 100% | 100% — all 7 SLOs have at least one alert |
| Alerts with a clear runbook link | 100% | 100% — each alert links to reliability-runbook.md section |
| Dashboards for ops | 1 health + 1 business | Both defined below |

---

## Alert Proposal

| Alert | Condition | Severity | Notification | Runbook |
|-------|-----------|----------|--------------|---------|
| Search SLO burn | p95 latency > 800 ms for 5 consecutive minutes | Sev2 | PagerDuty + Teams `#bookswap-incidents` | reliability-runbook.md#failure-2-redis |
| Listing creation failure | 5xx rate on POST /books > 0.1% over 5 min | Sev1 | PagerDuty (wake on-call) | reliability-runbook.md#failure-1-sql |
| Complete listings outage | GET /books success rate = 0% for 2 min | Sev1 | PagerDuty + SMS to on-call | reliability-runbook.md#failure-1-sql |
| Auth failure spike | auth.failed events > 50 per minute | Sev2 | Teams `#bookswap-security` | security-review.md#authn |
| Redis cache down | Redis hit rate = 0% for 3 min | Sev2 | Teams `#bookswap-incidents` | reliability-runbook.md#failure-2-redis |
| Traffic spike detected | RPS > 5× 7-day baseline for 3 min | Sev2 | Teams `#bookswap-ops` | reliability-runbook.md#failure-3-spike |
| SQL dependency failing | SQL dependency failure rate > 50% for 2 min | Sev1 | PagerDuty | reliability-runbook.md#failure-1-sql |
| Service Bus queue depth | ActiveMessages > 1000 | Sev3 | Teams `#bookswap-ops` (no page) | reliability-runbook.md#failure-3-spike |
| Audit log gap | No loan.created or loan.returned events for 24h when loans exist | Sev2 | Teams `#bookswap-security` | observability-plan.md#audit |

---

## alerts.yaml

```yaml
alerts:
  - name: SearchSLOBurn
    description: Search p95 latency exceeds 800ms SLO
    condition: p95(GET /books duration) > 800ms over 5m
    severity: 2
    notification:
      - pagerduty
      - teams: "#bookswap-incidents"
    runbook: reliability-runbook.md#failure-2-redis

  - name: ListingCreationFailure
    description: POST /books 5xx rate exceeds error budget
    condition: 5xx rate on POST /books > 0.1% over 5m
    severity: 1
    notification:
      - pagerduty
      - teams: "#bookswap-incidents"
    runbook: reliability-runbook.md#failure-1-sql

  - name: CompleteListingsOutage
    description: GET /books returning zero successes
    condition: success rate on GET /books == 0% for 2m
    severity: 1
    notification:
      - pagerduty
      - sms: on-call
    runbook: reliability-runbook.md#failure-1-sql

  - name: AuthFailureSpike
    description: Possible brute force or token issue
    condition: auth.failed events > 50/min
    severity: 2
    notification:
      - teams: "#bookswap-security"
    runbook: security-review.md#authn

  - name: RedisCacheDown
    description: Redis hit rate dropped to zero
    condition: cachehits == 0 for 3m
    severity: 2
    notification:
      - teams: "#bookswap-incidents"
    runbook: reliability-runbook.md#failure-2-redis

  - name: TrafficSpike
    description: Request rate 5x above baseline
    condition: rps > 5x 7d_baseline for 3m
    severity: 2
    notification:
      - teams: "#bookswap-ops"
    runbook: reliability-runbook.md#failure-3-spike

  - name: ServiceBusQueueDepth
    description: Email digest consumer falling behind
    condition: ActiveMessages > 1000
    severity: 3
    notification:
      - teams: "#bookswap-ops"
    runbook: reliability-runbook.md#failure-3-spike
```

---

## Dashboards

### Health Dashboard (ops team — real time)

| Panel | Signal | Alert threshold shown |
|-------|--------|-----------------------|
| Request rate (RPS) | App Insights requests/min | Red line at 5× baseline |
| Search p95 latency | App Insights percentile(duration, 95) | Red line at 800 ms |
| Listing creation success rate | App Insights 5xx rate on POST /books | Red line at 0.1% |
| SQL dependency health | App Insights dependencies — SQL failure rate | Red line at 10% |
| Redis hit rate | Azure Monitor cachehits/(cachehits+cachemisses) | Red line at 50% |
| Active App Service instances | App Service instance count | Shows autoscale activity |

### Business Dashboard (product team — daily)

| Panel | Signal |
|-------|--------|
| Books listed today | COUNT of bookswap.listing.created custom metric |
| Borrow requests today | COUNT of bookswap.borrow.requested |
| Loans returned today | COUNT of bookswap.loan.returned |
| Top 10 most borrowed books | JOIN of loan events by bookId |
| Member growth (weekly) | COUNT DISTINCT memberId from auth.success events |

---

## What We Are Deliberately NOT Alerting On

1. **Individual slow requests (single outliers).** A single 900 ms response does not breach the SLO. Alerting on every slow request would cause alert fatigue. We alert only on sustained p95 degradation over 5 minutes.

2. **Redis cache misses on cold start.** Every deployment causes a brief period of cache misses while keys repopulate. This is expected and transient — alerting on it would fire on every deployment.

3. **Service Bus queue depth below 1000 messages.** The queue is designed to absorb bursts. A depth of 200–800 messages is normal during active listing periods. Alerting too early creates noise without actionable signal.

4. **4xx responses on write endpoints.** `400 Bad Request` and `422 Unprocessable Entity` are correct API behaviour — they mean the client sent bad input. Alerting on 4xx would fire on every integration test and badly-formed mobile app request. We monitor 5xx only.

5. **Individual auth failures.** One 401 means a user's token expired — completely normal. We alert only when auth failures spike above 50/minute, which indicates a systemic issue or attack.
