# ADR 0004: Store Receipt Files in Blob Storage Using Signed URLs

## 1. Status (current decision state)

Accepted

Date: 2026-05-13

## 2. Context (why this decision was needed)

Staff need to upload receipt files with reimbursement claims.

Upload rules:

- up to 5 receipts per claim
- each file can be up to 10 MB
- files may be JPEG, PNG, or PDF
- uploads should work on unreliable Wi-Fi

The team needed a safe and reliable upload method.

## 3. Decision (what the team chose)

Receipt files will be stored in:

Azure Blob Storage

Upload method:

- signed URL / SAS URL

SAS upload expiry:

- 60 minutes

Upload flow:

1. User submits claim metadata
2. API creates temporary signed upload URLs
3. Browser uploads files directly to Blob Storage
4. API stores receipt metadata in the database

Blob containers:

- `quarantine` for newly uploaded files
- `receipts` for files that passed scanning

Virus scanning:

- Microsoft Defender for Storage

Read access:

- short-lived read SAS URLs
- 1-hour expiry

## 4. Consequences (benefits and risks)

Benefits:

- large files do not pass through the API server
- API memory usage stays low
- Blob Storage handles upload traffic
- browser retries can go directly to Blob Storage
- uploads are better for unreliable Wi-Fi
- receipt files are not public

Risks:

- quarantine status must be tracked
- scan status must be tracked
- files must move after scanning
- Event Grid or scan completion events may be needed
- receipt status must be stored in the database

## 5. Alternatives Considered (other options rejected)

Option 1: Upload through the API

Rejected because:

- large files would use API memory
- many uploads could slow the API
- response time targets may be affected

Option 2: Skip virus scanning

Rejected because:

- receipts are finance documents
- managers may open uploaded files
- malicious files would be too risky

## 6. Simple Summary (one-line recap)

GreenChit will upload receipts directly to Azure Blob Storage using 60-minute signed URLs, scan them in quarantine, and move safe files to the receipts container.
