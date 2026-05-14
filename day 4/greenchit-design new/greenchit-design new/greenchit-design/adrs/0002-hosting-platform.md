# ADR 0002: Host the API on Azure App Service

## 1. Status (current decision state)

Accepted

Date: 2026-05-13

## 2. Context (why this decision was needed)

The team needed to choose a hosting platform for the GreenChit Claims API.

Options compared:

- Azure App Service
- Azure Container Apps
- Azure Kubernetes Service

Project facts:

- 6-week deadline
- 10-person team
- no real Container Apps deployment experience
- around 200 BISTEC staff
- low expected traffic
- App Service is already used inside BISTEC

## 3. Decision (what the team chose)

The Claims API will run on:

Azure App Service

Plan:

P2v3

Used for:

- Claims API
- Node.js / Express backend

Background workers will run on:

Azure Functions consumption plan

Workers:

- Notification Worker
- Export Worker

Deployment slots:

- staging slot
- production slot

## 4. Consequences (benefits and risks)

Benefits:

- fast first deployment
- works with GitHub Actions
- no Docker setup needed
- easier monitoring with App Insights
- staging and production slots reduce release risk
- team can focus on business features

Risks:

- components cannot be deployed independently
- the whole API is redeployed together
- scaling is less flexible than Container Apps
- the team does not gain container experience in this project

## 5. Alternatives Considered (other options rejected)

Option 1: Azure Container Apps

Rejected for v1 because:

- needs Dockerfiles
- needs Azure Container Registry
- needs Container Apps Environment setup
- needs KEDA scaling rules
- team has no prior experience
- setup could take too much time

Option 2: Azure Kubernetes Service

Rejected because:

- too complex
- too much operational work
- unnecessary for a small internal tool
- team would spend too much time managing infrastructure

## 6. Simple Summary (one-line recap)

GreenChit will host the Claims API on Azure App Service because it is faster, simpler, and safer for the first 6-week release.
