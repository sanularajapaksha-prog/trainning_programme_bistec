# BookSwap — Storage and Cache Decisions

## 1. Data Inventory

| Data type | Example record | Volume estimate (1 year) | Read/write ratio |
|-----------|---------------|--------------------------|------------------|
| Book listing | title, author, ISBN, condition, available | ~50,000 rows | read-heavy (10:1) |
| Member profile | display name, email, entra_id | ~5,000 rows | read-heavy (20:1) |
| Borrow request | book_id, requester_id, status, message | ~100,000 rows | write-heavy |
| Loan record | book_id, borrower_id, status, borrowed_at, returned_at | ~80,000 rows | mixed |
| Book photo | JPEG/PNG file per book, up to 5 MB | ~250 GB total | write-once, read-many |
| Email digest | JSON payload with 10 newest books + recipient list | ~500 messages/week | write-once, consumed-once |

---

## 2. Storage Selection

| Data type | Chosen store | Why |
|-----------|-------------|-----|
| Book listing | Azure SQL | Relational data, needs JOINs with members and loans, ACID transactions keep availability flag consistent |
| Member profile | Azure SQL (same DB) | Shares FK with books and loans, easier to JOIN in one query |
| Borrow request | Azure SQL (same DB) | Needs FK to books and members, status transitions need to be transactional |
| Loan record | Azure SQL (same DB) | Overdue query is a simple WHERE clause, easy to report with SQL |
| Book photo | Azure Blob Storage | Binary files up to 5 MB, storing BLOBs in SQL would bloat the DB and slow backups |
| Email digest | Azure Service Bus | Decouples email sending from book listing — if email service is down, messages wait in the queue instead of failing the user's request |

---

## 3. Cache Plan

**What to cache:** Individual book records (`GET /books/{bookId}`)
Book metadata changes rarely so caching for 60 seconds avoids repeated DB hits for popular books.

**What not to cache:**
- Borrow/loan status — changes too frequently, stale data could show a borrowed book as available
- Paginated search results — too many query combinations, invalidation is too complex

**Cache-aside pattern:**

```javascript
async function getBook(bookId) {
  const cacheKey = `book:${bookId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const row = await db.query('SELECT * FROM books WHERE id = $1', [bookId]);
  if (!row) return null;

  await redis.set(cacheKey, JSON.stringify(row), 'EX', 60);
  return row;
}

async function updateBook(bookId, patch) {
  const updated = await db.update('books', bookId, patch);
  await redis.del(`book:${bookId}`);
  return updated;
}
```

| Decision | Choice | Reason |
|----------|--------|--------|
| TTL | 60 seconds | Book metadata rarely changes, short staleness is acceptable |
| Invalidation | On PATCH /books/{bookId} | Delete cache key so next read gets fresh data |
| Cache key | `book:{bookId}` | Simple and unique |
| Source of truth | Azure SQL | Cache is just a copy |

---

## 4. Queue Plan

**What goes on the queue:** Weekly email digest via Azure Service Bus.

When a book is listed, a message is published to the queue. A background consumer reads it weekly and sends the digest email using Azure Communication Services.

**Why a queue?** The NFR says listing creation must succeed even if the email service is down. A direct API call would block the user if email is slow or down. With a queue, the book is saved and the API returns 201 immediately — the email is sent later.

**If the consumer is down:**

| Scenario | What happens |
|----------|-------------|
| Consumer is down | Messages stay in the queue (retained up to 14 days) |
| Consumer comes back | Reads and processes all queued messages |
| Message keeps failing | Moved to Dead Letter Queue, alert fires for engineer |

The user's book listing is unaffected — it was already saved when they got the 201 response.
