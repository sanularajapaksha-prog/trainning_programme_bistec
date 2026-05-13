# BookSwap — Reliability Runbook v0.1

---

## Failure 1: Azure SQL primary unavailable for 5 minutes

### What the user sees

- `GET /books` returns `503 Service Unavailable`
- `POST /books` returns `503` — cannot list a book
- `POST /books/{bookId}/borrow-requests` returns `503` — cannot send a borrow request
- `/health` still returns `200` because it should not depend on SQL
- Users see a message like _"Something went wrong. Please try again shortly."_

### Detection

Azure Application Insights tracks SQL dependency failures. If more than 50% of SQL calls fail in a 2 minute window an alert fires to PagerDuty and the `#bookswap-incidents` Teams channel.

```kusto
dependencies
| where timestamp > ago(5m)
| where type == "SQL"
| summarize failed = countif(success == false), total = count()
| where failed > 0.5 * total
```

Expected detection time is under 2 minutes.

### Mitigation in design

**Connection pool — fail fast:**

```
SET max connections = 20
SET connection timeout = 3 seconds
SET idle timeout = 10 seconds

IF a connection is not available within 3 seconds
  RETURN 503 immediately
  DO NOT queue the request
```

**Retry with exponential backoff:**

```
SET max attempts = 3
SET base wait = 200ms

FOR each attempt:
  TRY the database call
  IF it succeeds → RETURN result
  IF error is transient (connection refused or timeout):
    IF this was the last attempt → THROW error
    WAIT (base wait x 2^attempt) + small random delay
    TRY again
  IF error is not transient → THROW immediately, do not retry
```

**Circuit breaker:**

```
KEEP a counter of consecutive SQL failures

IF failures >= 5:
  OPEN the circuit for 30 seconds
  RETURN 503 to all requests without touching the database
  AFTER 30 seconds → close the circuit and try again

IF a request succeeds:
  RESET the failure counter
```

**Azure SQL failover:**

```
Connection string points to the failover group endpoint, NOT the primary server

IF primary goes down:
  Azure automatically promotes the replica
  Failover completes in under 30 seconds
  App reconnects to the new primary through the same endpoint
```

### Manual response

1. On-call engineer gets paged via PagerDuty (Severity 1)
2. Check Azure Portal → SQL Server → Overview to see server status
3. Check Azure Service Health to see if there is a regional outage
4. If regional outage — go to Azure Portal → SQL Server → Failover groups → Initiate failover manually
5. If connection pool is exhausted — restart the App Service instance
6. Post a status update in `#bookswap-status` within 5 minutes of being paged

### Post-incident actions

- [ ] Add a read replica so `GET /books` queries hit the replica and not the primary
- [ ] Confirm Azure SQL auto-failover group is set up correctly
- [ ] Add a `/health/db` endpoint that checks SQL separately from the main health check
- [ ] Write a blameless post-mortem within 48 hours

---

## Failure 2: Azure Cache for Redis is down

### What the user sees

- `GET /books/{bookId}` is slower than usual — around 300–600 ms instead of 20–50 ms
- `GET /books` list still works
- No actual errors — the app falls back to the database automatically
- If the database is also under heavy load at the same time, latency could go above the 800 ms SLO

### Detection

Redis cache hit rate drops to zero in Azure Monitor.

```kusto
AzureMetrics
| where ResourceType == "MICROSOFT.CACHE/REDIS"
| where MetricName == "cachehits"
| summarize hits = sum(Total) by bin(TimeGenerated, 1m)
| where hits == 0
```

Alert condition: hit rate stays at 0 for 3 minutes → Severity 2 → Teams `#bookswap-incidents`. This is not a PagerDuty page because the system is still working, just slower.

### Mitigation in design

**Cache-aside pattern with graceful fallback:**

```
WHEN a request comes in for a book:

  TRY to read from Redis cache
    IF found → RETURN cached data immediately
    IF Redis is down → LOG the miss, continue to next step (do not crash)

  READ from the database
    IF not found → RETURN 404

  TRY to write the result back to Redis with a 60 second expiry
    IF Redis write fails → ignore, still RETURN the data from database

RETURN the result
```

**Redis connection — fail fast:**

```
SET connect timeout = 1 second
SET command timeout = 500ms
SET max retries per command = 1

IF Redis does not respond within 1 second:
  GIVE UP on Redis
  FALL BACK to database immediately
```

**What is not cached:** borrow request status, loan status, and member profile. These change often and stale data here would cause real problems.

### Manual response

1. Teams alert notifies on-call engineer (Severity 2)
2. Check Azure Portal → Azure Cache for Redis → Overview
3. If Redis is in a failed state — try a reboot from the portal (Primary node reboot)
4. If reboot does not work — scale up the Redis tier so a replica is available for auto-failover
5. Watch Azure SQL DTU — a cold cache means a lot more DB reads, check it is not getting throttled
6. Post in `#bookswap-status` that searches will be slower until Redis recovers

### Post-incident actions

- [ ] Upgrade Redis from Basic to Standard tier — Standard has a replica and supports auto-failover
- [ ] Add a Redis health metric to Application Insights
- [ ] Check if the 800 ms SLO held during the outage — if not, add a note to the SLO record
- [ ] Consider a cache warm-up job that loads the top 100 books into Redis on startup

---

## Failure 3: Sunday tabloid spike — 10x sustained traffic

### What the user sees

- Normal experience for the first 5–10 minutes while autoscale adds instances
- During scale-out some write requests get a `429 Too Many Requests` from the rate limiter
- `GET /books` stays fast because Redis handles the read traffic
- `POST /books` may take a few seconds longer but eventually succeeds
- Email digests may be delayed by a few hours — this is expected behaviour

### Detection

Request rate on `GET /books` goes above 5x the normal baseline for 3 minutes in a row.

```kusto
requests
| where timestamp > ago(5m)
| where name == "GET /books"
| summarize rps = count() / 300.0 by bin(timestamp, 1m)
```

Alert condition: RPS > 5x baseline for 3 minutes → Severity 2 → Teams `#bookswap-ops`

Secondary signals: App Service CPU above 70% for 5 minutes, or Azure SQL DTU above 80% for 5 minutes.

### Mitigation in design

**Azure Front Door rate limiting:**

```
FOR every incoming POST request to /books:
  COUNT requests from this IP in the last 60 seconds
  IF count > 100:
    RETURN 429 Too Many Requests
    ADD response header: Retry-After: 60
  ELSE:
    ALLOW the request through
```

**App Service autoscale:**

```
EVERY 5 minutes check CPU usage:
  IF CPU > 70% for 5 minutes:
    ADD 2 more instances (up to a max of 10)
  IF CPU < 30% for 20 minutes:
    REMOVE 1 instance (down to a min of 2)
  WAIT 5 minutes before checking again (cooldown)
```

**Idempotency key to prevent duplicate listings on retry:**

```
WHEN POST /books is received:
  READ the idempotency key from the request header

  IF key exists in database:
    RETURN the stored response immediately
    DO NOT create a duplicate book

  IF key is new or missing:
    CREATE the book normally
    STORE the response against the key with a 24 hour expiry
    RETURN 201 Created
```

**Service Bus queue absorbs email load:**

```
WHEN a book is listed:
  SAVE the book to the database
  PUBLISH a message to the Service Bus queue
  RETURN 201 immediately — do not wait for the email to send

Email consumer runs separately:
  READS messages from the queue at its own pace
  SENDS the email digest
  IF spike is happening the queue builds up and drains after the spike ends
```

### Manual response

1. Teams alert notifies on-call engineer (Severity 2)
2. Check Azure Portal → App Service → Scale out → confirm autoscale is triggering
3. If autoscale is not kicking in — manually set instance count to 8 in the portal
4. If SQL is being throttled — temporarily scale up vCores in Azure Portal
5. Check Front Door WAF logs to confirm `429` responses are hitting the right IPs
6. After spike ends — scale instances back down manually if autoscale scale-in is too slow
7. Post status updates every 30 minutes in `#bookswap-status` while the spike is ongoing

### Post-incident actions

- [ ] Run a load test at 10x RPS before the next expected spike using Azure Load Testing
- [ ] Switch autoscale trigger from CPU to HTTP queue length — CPU reacts slower than request queue
- [ ] Add an Azure SQL read replica to offload GET queries during spikes
- [ ] Check Service Bus queue depth during the spike — if it went above 10,000 messages, increase consumer concurrency
