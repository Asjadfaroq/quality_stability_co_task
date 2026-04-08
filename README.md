# Service Marketplace Platform (Senior Fullstack Take-Home)

This repository contains my implementation of the **Service Marketplace Platform (MVP)** from `Recruitment_Task.md`.

The platform allows:
- Customers to create service requests
- Providers to discover and accept nearby requests
- API-level RBAC with dynamic permissions
- Subscription-based feature gating
- AI-powered request assistance

## Live URL

- Frontend: [https://yellow-sand-0fab52c03.4.azurestaticapps.net/](https://yellow-sand-0fab52c03.4.azurestaticapps.net/)

---

## Requirement Coverage (From Recruitment Task)

### 1) Authentication & RBAC
- JWT authentication implemented with ASP.NET Core Identity.
- Roles implemented: `Admin`, `ProviderAdmin`, `ProviderEmployee`, `Customer`.
- Access control is enforced at API level via `[Authorize]` + custom `[RequirePermission("...")]`.
- UI role separation exists (Customer/Provider/Admin flows), but API remains source of truth.

### 2) Core Functionality
- **Customer**
  - Create request (`title`, `description`, `location`)
  - View own requests and statuses
- **Provider**
  - View available requests
  - Retrieve nearby requests by radius
  - Accept request
  - Update status to complete
- **Lifecycle**
  - Implemented flow: `Pending -> Accepted -> PendingConfirmation -> Completed`
  - Includes auto-confirm background worker for stale confirmation cases

### 3) Geolocation
- Latitude/longitude stored per request.
- Nearby search implemented with radius filtering (bounding-box + Haversine).
- Map UI added as a bonus (React Leaflet).

### 4) Subscription / Feature Gating
- Free tier request cap enforced (default: 3 requests).
- Paid tier has no request limit.
- Real Stripe integration implemented (beyond assignment's "simulate if needed" baseline).

### 5) AI Feature
- AI request description enhancement + category suggestion implemented.
- AI help chat assistant implemented as additional AI feature.
- Graceful fallback is included if external AI call fails.

### 6) Frontend
- Functional frontend with role-aware pages/flows.
- Supports core actions: create, list, accept, complete, confirm, manage.
- Clear role-specific views for customer/provider/admin capabilities.

### 7) API & Backend Design
- Clean, layered architecture with clear responsibility separation.
- SQL schema managed via EF Core migrations.
- Maintainable service-based design with interfaces and DI.

### 8) Advanced RBAC (Bonus)
- Permission model is dynamic, not hardcoded strictly by role.
- Permission keys include examples from task:
  - `request.create`
  - `request.accept`
  - `request.complete`
  - `request.view_all`
- Admin can grant/revoke role and user-level permissions.
- ProviderAdmin can manage scoped employee permissions inside own organization.
- ProviderEmployee receives limited permissions.

---

## Deliverables Checklist

### 1) Source Code
- This GitHub repository contains full source for backend + frontend.

### 2) README Includes
- Setup instructions (local + Docker)
- Architecture overview
- Key design decisions and trade-offs
- RBAC design explanation (storage + enforcement)
- Improvements with more time

### 3) API Documentation
- Swagger is enabled and available at `/swagger` when API is running.

### 4) Run Instructions
- Docker-based run path is included below.
- Local run path is also included.

---

## Architecture Overview

### High-Level Layers
- **Presentation**: Controllers, SignalR hubs, middleware, rate limiting
- **Application**: Business services, validators, background jobs
- **Infrastructure**: EF Core, Redis, Stripe, AI provider, logging
- **Domain**: Entities, enums, constants, contracts

### Project Structure

```text
.
├── ServiceMarketplace.API/      # ASP.NET Core API
├── ServiceMarketplace.Client/   # React + TypeScript frontend
├── Documentation.md             # Detailed technical walkthrough
├── Recruitment_Task.md          # Assignment brief
├── docker-compose.yml
└── run.sh
```

---

## Tech Stack

### Backend
- ASP.NET Core 10 Web API
- Entity Framework Core + SQL Server
- ASP.NET Core Identity + JWT
- FluentValidation
- Redis (cache + distributed limiter support)
- SignalR
- Serilog + Azure Application Insights
- Stripe
- Swagger / OpenAPI

### Frontend
- React + TypeScript + Vite
- Zustand
- Axios
- SignalR client
- React Leaflet

### Platform / Ops
- Azure App Service (API)
- Azure Static Web Apps (Frontend)
- Azure SQL Server
- Upstash Redis
- GitHub Actions CI/CD

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

Expected endpoints:
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

Run backend:

```bash
cd ServiceMarketplace.API
dotnet restore
dotnet ef database update
dotnet run
```

Run frontend:

```bash
cd ServiceMarketplace.Client
npm install
npm run dev
```

---

## RBAC Design (How Permissions Are Stored and Enforced)

### Storage Model
- `RolePermissions`: default permission set for each role
- `UserPermissions`: per-user overrides (`Granted=true` add, `Granted=false` revoke)
- Effective permissions = role defaults +/- user overrides

### Enforcement Model
- Endpoints use `[RequirePermission("permission.name")]`.
- Middleware/filter extracts `userId` from JWT and checks effective permissions.
- Denied access returns `403 Forbidden` with a consistent permission-denied response.
- Admin role short-circuits permission checks by design.

### Dynamic Permission Management
- Admin can:
  - Change user roles
  - Change role-permission matrix
  - Set per-user permission overrides
- ProviderAdmin can manage employee permissions within own organization scope.

---

## Key Design Decisions & Trade-Offs

- **Permission-first authorization** over role-string-only checks for flexibility.
- **Two-tier caching (memory + Redis)** for hot-path permission checks; trade-off is explicit cache invalidation complexity.
- **EF Core code-first** for schema/version control; trade-off is migration discipline.
- **Real Stripe integration** (richer than assignment baseline); trade-off is extra external dependency complexity.
- **SignalR for real-time UX**; trade-off is additional connection/state handling.
- **Resilience + fallbacks** (Redis, AI) to keep user flows available under partial failures.

---

## Bonus Items Implemented

Beyond baseline requirements:
- Dockerized setup
- CI/CD pipeline
- Background jobs
- Caching strategy
- Logging + error handling strategy
- Real-time updates with WebSockets (SignalR)

---

## API Documentation

- Swagger/OpenAPI UI is available at `/swagger` when API is running.

---

## What I Would Improve With More Time

- Add end-to-end integration tests for full request lifecycle and RBAC edge cases.
- Add prebuilt Application Insights/Kusto dashboards for audit/incident workflows.
- Add stronger outbox/event-driven patterns for high-scale consistency paths.
- Add attachment/file proof flow for request completion.
- Expand operational runbooks and alerting thresholds.

---

## Additional Notes

- Full deep-dive technical documentation is available in `Documentation.md`.
- This README is aligned directly to the requirements and deliverables in `Recruitment_Task.md`.
