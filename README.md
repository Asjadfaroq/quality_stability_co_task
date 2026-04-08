<div align="center">

# Service Marketplace Platform

**Senior Fullstack Engineer Take-Home (MVP) — API-level RBAC, geolocation requests, subscription gating, AI assistance, and real-time updates.**

[![Live App](https://img.shields.io/badge/Live_App-Azure_Static_Web_Apps-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=fff)](https://yellow-sand-0fab52c03.4.azurestaticapps.net/)
[![API](https://img.shields.io/badge/API-ASP.NET_Core_10-512BD4?style=for-the-badge&logo=dotnet&logoColor=fff)](./ServiceMarketplace.API)
[![Frontend](https://img.shields.io/badge/Frontend-React_%2B_TS-61DAFB?style=for-the-badge&logo=react&logoColor=000)](./ServiceMarketplace.Client)

</div>

---

## Overview

This repository is my implementation of the HR assignment in `Recruitment_Task.md`.

The platform allows customers to create service requests and providers to discover, accept, and complete nearby work, with permission-based access control enforced at the API layer.

**Stack:** ASP.NET Core 10, Entity Framework Core, SQL Server, React + TypeScript (Vite), SignalR, Redis, Stripe, Serilog, Azure Application Insights.

---

## Requirement Coverage (From Recruitment Task)

### 1) Authentication & RBAC
- JWT auth with ASP.NET Core Identity.
- Roles implemented: `Admin`, `ProviderAdmin`, `ProviderEmployee`, `Customer`.
- API-level enforcement via `[Authorize]` + `[RequirePermission("...")]`.
- Role-specific frontend flows, but authorization is enforced server-side.

### 2) Core Functionality
- **Customer:** create requests (`title`, `description`, `location`), view own requests and statuses.
- **Provider:** view available requests, retrieve nearby requests, accept requests, mark complete.
- **Lifecycle:** implemented as `Pending -> Accepted -> PendingConfirmation -> Completed`.

### 3) Geolocation
- Stores latitude/longitude per request.
- Nearby filter by radius (bounding-box query + Haversine calculation).
- Map UI implemented as bonus via React Leaflet.

### 4) Subscription / Feature Gating
- Free users are limited to a configurable request cap (default 3).
- Paid users have no request limit.
- Real Stripe integration is implemented (stronger than minimum requirement).

### 5) AI Feature
- AI description enhancement and category suggestion.
- AI help chat assistant as an additional AI feature.
- External AI failures fall back to safe behavior so user flow remains functional.

### 6) Frontend
- Functional UI with role-aware screens and flows.
- Supports required actions (create/accept/complete and related request management).
- Clear separation by role behavior.

### 7) API & Backend Design
- Clean layered architecture with maintainable service boundaries.
- Database schema managed via EF Core migrations.
- DI + interfaces used across services.

### 8) Advanced RBAC (Bonus)
- Dynamic permission system (not only hardcoded role checks).
- Includes task-specified permissions such as:
  - `request.create`
  - `request.accept`
  - `request.complete`
  - `request.view_all`
- Admin can assign/revoke permissions at role and user level.
- ProviderAdmin can manage employee permissions within organization scope.

---

## Deliverables Checklist

- **Source code:** included in this GitHub repo.
- **README includes:** setup, architecture, design decisions/trade-offs, RBAC design, improvements.
- **API docs:** Swagger/OpenAPI available when API runs.
- **Run instructions:** Docker and local instructions provided below.

---

## Features

- API-level RBAC with dynamic role/user permission overrides
- Request lifecycle management with optimistic concurrency protections
- Real-time notifications and chat via SignalR
- Geolocation-based nearby request discovery
- Stripe billing integration with webhook processing
- Background jobs for auto-confirmation, stale cleanup, and chat retention
- Redis-backed caching and rate limiting (with fallback behavior)
- Structured logging with Serilog + Azure Application Insights

---

## Architecture

### Layered Design
- **Presentation:** Controllers, Hubs, Middleware
- **Application:** Services, Validators, Background Jobs
- **Infrastructure:** EF Core, Redis, Stripe, AI clients, logging
- **Domain:** Entities, enums, constants, contracts

### Repository Structure

```text
.
├── ServiceMarketplace.API/      # ASP.NET Core backend
├── ServiceMarketplace.Client/   # React + TypeScript frontend
├── Documentation.md             # Full technical documentation
├── Recruitment_Task.md          # Assignment brief from HR
├── docker-compose.yml
└── run.sh
```

---

## Setup Instructions

## Option A: Docker (Recommended)

Set required environment variables:

```bash
export HUGGINGFACE_API_KEY=hf_your_key_here
export STRIPE_SECRET_KEY=sk_test_your_key
export STRIPE_WEBHOOK_SECRET=whsec_your_secret
export STRIPE_PRICE_ID=price_your_price_id
export JWT_KEY=your-secret-key-minimum-32-characters-long!!
```

Run:

```bash
docker compose up --build
```

Endpoints:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger`

## Option B: Local Development

### Prerequisites
- .NET 10 SDK
- Node.js 20+
- SQL Server
- Redis (optional but recommended)

Create `ServiceMarketplace.API/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=ServiceMarketplaceDb;User Id=sa;Password=YourPassword;TrustServerCertificate=True;",
    "Redis": "localhost:6379"
  },
  "Jwt": {
    "Key": "your-secret-key-minimum-32-characters-long!!",
    "Issuer": "ServiceMarketplace",
    "Audience": "ServiceMarketplaceClient",
    "ExpiryMinutes": 1440
  },
  "HuggingFace": {
    "ApiKey": "hf_your_key_here"
  },
  "Stripe": {
    "SecretKey": "sk_test_your_key",
    "WebhookSecret": "whsec_your_secret",
    "PriceId": "price_your_price_id"
  },
  "ApplicationInsights": {
    "ConnectionString": ""
  },
  "Subscription": {
    "FreeRequestLimit": 3
  }
}
```

Backend:

```bash
cd ServiceMarketplace.API
dotnet restore
dotnet ef database update
dotnet run
```

Frontend:

```bash
cd ServiceMarketplace.Client
npm install
npm run dev
```

---

## RBAC Design (Storage + Enforcement)

### Storage
- `RolePermissions`: default permission matrix per role
- `UserPermissions`: per-user overrides (`Granted=true` add, `Granted=false` revoke)
- Effective permissions are computed from role defaults plus user overrides

### Enforcement
- Protected endpoints use `[RequirePermission("permission.name")]`.
- User identity is read from JWT claims.
- Permission check runs at API layer before controller action logic.
- Unauthorized permission returns `403 Forbidden`.

### Dynamic Management
- Admin can update role permissions and user-level overrides.
- ProviderAdmin can manage employees in own organization scope.

---

## Key Design Decisions & Trade-Offs

- Permission-first model for flexibility over static role checks.
- Two-tier cache (L1 memory + L2 Redis) for high-frequency authorization checks.
- Real Stripe implementation to show production-grade billing paths.
- SignalR for instant UX, with added connection/state complexity.
- Resilience/fallback paths to keep core user flows working under transient failures.

---

## Bonus Items Implemented

- Dockerized setup
- CI/CD pipeline
- Background jobs
- Caching
- Logging and error handling strategy
- Real-time updates (SignalR/WebSockets)

---

## API Documentation

- Swagger/OpenAPI UI is available at `/swagger` when API is running.

---

## What I Would Improve With More Time

- Add comprehensive integration/E2E coverage for lifecycle + RBAC edge cases.
- Add saved Kusto dashboards/alerts for audit, auth failures, and webhook anomalies.
- Introduce outbox/event-driven patterns for high-scale consistency paths.
- Expand operational runbooks and SLO-driven monitoring.

---

<div align="center">

**Developed by [Asjad Farooq](https://www.linkedin.com/in/asjadfarooqconnect)**

[![GitHub](https://img.shields.io/badge/GitHub-Asjadfaroq-181717?style=flat-square&logo=github)](https://github.com/Asjadfaroq/quality_stability_co_task)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Asjad_Farooq-0A66C2?style=flat-square&logo=linkedin&logoColor=fff)](https://www.linkedin.com/in/asjadfarooqconnect)
[![Live App](https://img.shields.io/badge/Live_App-Service_Marketplace-0078D4?style=flat-square&logo=microsoftazure&logoColor=fff)](https://yellow-sand-0fab52c03.4.azurestaticapps.net/)

</div>
