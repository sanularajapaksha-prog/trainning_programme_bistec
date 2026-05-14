# ADR 0005: Make the Audit Log Tamper-Evident

## 1. Status (current decision state)

Accepted

Date: 2026-05-13

## 2. Context (why this decision was needed)

GreenChit is a finance system.

The system must record every claim state change.

Examples:

- Draft to Submitted
- Submitted to Approved
- Submitted to Rejected
- Submitted to Info Requested

Each audit row records:

- who made the change
- when it happened
- old status
- new status
- rejection reason if available

Audit records must be kept for:

- 7 years

## 3. Decision (what the team chose)

GreenChit will make the audit log tamper-evident.

Method:

- use an insert-only database user
- store a SHA-256 hash for each audit row
- keep audit records for 7 years

Special database user:

`greenchit_audit_writer`

This user can:

- insert audit rows

This user cannot:

- update audit rows
- delete audit rows

Retention approach:

- keep records in SQL for 2 years
- move older records to Blob Storage cold tier

## 4. Consequences (benefits and risks)

Benefits:

- protects audit history
- supports finance policy
- reduces accidental modification risk
- makes audit controls easier to explain

Risks:

- wrong audit rows cannot be edited later
- migration scripts must not damage audit tables
- archival process still needs detailed design
- row hashes alone do not stop a database admin from recomputing hashes

## 5. Alternatives Considered (other options rejected)

Option 1: Azure Immutable Blob Storage

Rejected for v1 because:

- harder to query
- needs extra tooling
- more setup time

Option 2: Regular SQL table with normal permissions

Rejected because:

- rows could be updated
- rows could be deleted
- bugs could damage audit history
- finance audit risk would be too high

## 6. Simple Summary (one-line recap)

GreenChit will protect audit logs using an insert-only SQL user and row hashes so old audit records cannot be changed easily without detection.
