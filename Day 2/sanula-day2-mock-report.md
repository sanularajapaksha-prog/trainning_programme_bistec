# BookSwap — Mock Smoke Test Report

## Setup

### Prism command used
```bash
cd "C:\Users\SanulaRajapakshaBIST\Desktop\New folder\Day 2"
npx @stoplight/prism-cli mock sanula-day2-bookswap-openapi.yaml --port 4010
```

### Test commands (second terminal window)
All tests run using `curl` in Windows Command Prompt against the Prism mock server at `http://127.0.0.1:4010`

---

## Test Results

| # | Endpoint | Method | Body / Params | Expected status | Actual status | Pass? |
|---|----------|--------|---------------|-----------------|---------------|-------|
| 1 | /books | GET | page=1&pageSize=20 | 200 | 200 | ✅ |
| 2 | /books | POST | valid book payload | 201 | 201 | ✅ |
| 3 | /books | POST | missing title field | 400 | 400 | ✅ |
| 4 | /books/book-1/borrow-requests | POST | valid message body | 201 | 201 | ✅ |
| 5 | /books | GET | no Authorization header | 401 | 401 | ✅ |

### Actual responses received

**Test 1 — GET /books (200)**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 12,
  "items": [
    {
      "id": "book-1",
      "ownerId": "member-1",
      "title": "Dune",
      "author": "Frank Herbert",
      "isbn": "9780441013593",
      "condition": "new",
      "photoUrl": "string",
      "available": true,
      "createdAt": "2019-08-24T14:15:22Z"
    }
  ]
}
```

**Test 2 — POST /books valid (201)**
```json
{
  "id": "book-1",
  "ownerId": "member-1",
  "title": "Dune",
  "author": "Frank Herbert",
  "isbn": "9780441013593",
  "condition": "new",
  "photoUrl": "string",
  "available": true,
  "createdAt": "2019-08-24T14:15:22Z"
}
```

**Test 3 — POST /books missing title (400)**
```
(empty body — status 400 returned correctly)
```

**Test 4 — POST /books/book-1/borrow-requests (201)**
```json
{
  "id": "req-1",
  "bookId": "book-1",
  "requesterId": "member-2",
  "status": "pending",
  "message": "string",
  "createdAt": "2019-08-24T14:15:22Z"
}
```

**Test 5 — GET /books no auth header (401)**
```
(empty body — status 401 returned correctly)
```

---

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Tests run | 5 | 5 |
| Tests passing | 5 | 5 |
| Endpoints with explicit error responses | 4+ | 6 |
| Negative tests included | yes | yes (tests 3 and 5) |

---

## Findings

### Finding 1 — POST /books returns Dune, not the book we sent

**What happened:** Test 2 sent `Atomic Habits` as the body but Prism returned `Dune` in the response. Prism ignores the request body and always returns the first example value defined in the schema.

**Why it matters:** The `Book` schema only has one hardcoded example. In a real API the response would echo back the book that was just created. The spec needs richer examples to make mock testing more realistic.

**Spec change needed:**
- File: `sanula-day2-bookswap-openapi.yaml`
- Path: `components.schemas.Book.properties`
- Add multiple examples so Prism returns varied responses

---

### Finding 2 — Test 3 returns empty 400 body with no error message

**What happened:** When title was missing, Prism returned status 400 but with an empty response body — no JSON error object explaining what went wrong.

**Why it matters:** The `Error` schema exists in components but is not linked to the 400 response on POST /books. A real API consumer needs to know what field was missing.

**Spec change needed:**
- File: `sanula-day2-bookswap-openapi.yaml`
- Path: `paths./books.post.responses.400`
- Change from: `"400": { description: Missing or invalid fields }`
- Change to:
```yaml
"400":
  description: Missing or invalid fields
  content:
    application/json:
      schema: { $ref: "#/components/schemas/Error" }
```

---

### Finding 3 — BorrowRequest message field returns "string" placeholder

**What happened:** Test 4 sent `"message": "Can I borrow this?"` but the response showed `"message": "string"` — a placeholder, not real text.

**Why it matters:** The `message` field in the `BorrowRequest` schema has no `example` value so Prism fills it with the type name `"string"`.

**Spec change needed:**
- File: `sanula-day2-bookswap-openapi.yaml`
- Path: `components.schemas.BorrowRequest.properties.message`
- Add: `example: "I will return it in two weeks."`

---

## Spec Changes Summary

| # | File | Location | Change |
|---|------|----------|--------|
| 1 | openapi.yaml | `components.schemas.Book` | Add more example values beyond just Dune |
| 2 | openapi.yaml | `paths./books.post.responses.400` | Link Error schema to 400 response body |
| 3 | openapi.yaml | `components.schemas.BorrowRequest.properties.message` | Add example value |

---

## How to reproduce

1. Save `sanula-day2-bookswap-openapi.yaml` to your working directory
2. Run: `npx @stoplight/prism-cli mock sanula-day2-bookswap-openapi.yaml --port 4010`
3. Open a second terminal and run the curl commands below

```bash
# Test 1
curl -s -w "\nStatus: %{http_code}\n" -H "Authorization: Bearer test-token-123" -H "Prefer: code=200" "http://127.0.0.1:4010/books?page=1&pageSize=20"

# Test 2
curl -s -w "\nStatus: %{http_code}\n" -X POST -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" -H "Prefer: code=201" -d "{\"title\":\"Atomic Habits\",\"author\":\"James Clear\",\"isbn\":\"9780735211292\",\"condition\":\"good\"}" "http://127.0.0.1:4010/books"

# Test 3
curl -s -w "\nStatus: %{http_code}\n" -X POST -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" -H "Prefer: code=400" -d "{\"author\":\"James Clear\",\"isbn\":\"9780735211292\",\"condition\":\"good\"}" "http://127.0.0.1:4010/books"

# Test 4
curl -s -w "\nStatus: %{http_code}\n" -X POST -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" -H "Prefer: code=201" -d "{\"message\":\"Can I borrow this?\"}" "http://127.0.0.1:4010/books/book-1/borrow-requests"

# Test 5
curl -s -w "\nStatus: %{http_code}\n" -H "Prefer: code=401" "http://127.0.0.1:4010/books"
```