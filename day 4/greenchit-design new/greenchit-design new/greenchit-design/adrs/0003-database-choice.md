# ADR 0003: Use Azure SQL as the Database

## 1. Status (current decision state)

Accepted

Date: 2026-05-13

## 2. Context (why this decision was needed)

GreenChit needs to store structured reimbursement data.

Data to store:

- claims
- claimants
- managers
- receipt metadata
- audit log rows
- export job state

The data is relational.

Examples:

- one staff member can submit many claims
- one claim can have many receipts
- one claim belongs to one claimant
- one claim has one assigned manager
- every status change creates audit rows

Expected volume:

- around 200 claims per month

## 3. Decision (what the team chose)

GreenChit will use:

Azure SQL

Audit logs will be stored in:

- a separate SQL schema

Special audit database user:

`greenchit_audit_writer`

This user can:

- insert audit rows

This user cannot:

- update audit rows
- delete audit rows

Access control for v1 will be handled by:

- Claims API

## 4. Consequences (benefits and risks)

Benefits:

- team already knows SQL
- joins are easy
- finance CSV export is simple
- audit queries are easier
- relational data is clear
- audit data can be protected with database permissions

Risks:

- database migrations must be planned carefully
- schema changes must stay backward compatible
- old and new app versions may run briefly during slot swaps
- team has limited zero-downtime migration experience

## 5. Alternatives Considered (other options rejected)

Option 1: Cosmos DB

Rejected because:

- team does not know it well
- relational queries are harder
- audit queries may require scanning too much data
- no clear benefit for this small system

Option 2: One big table

Rejected because:

- data relationships are too complex
- duplication would increase
- queries would become messy
- maintenance would be harder

## 6. Simple Summary (one-line recap)

GreenChit will use Azure SQL because the system stores relational finance data and the team can query, export, and audit it easily.
