# Service Marketplace Platform

A full-stack service marketplace where customers post service requests, providers accept and complete them, and an admin manages users and permissions. Features role-based access control, subscription gating, geolocation filtering, and AI-enhanced descriptions.

---

## 1. Setup Instructions

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (for Docker setup)
- SQL Server (local) or Docker (handles it automatically)

---

### Option A — Run Locally

**1. Clone the repo**
```bash
git clone <repo-url>
cd quality_stability_co_task
```

**2. Configure secrets**

Create `ServiceMarketplace.API/appsettings.json` (git-ignored) with:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=ServiceMarketplaceDb;User Id=sa;Password=YourPassword;TrustServerCertificate=True;"
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
  "Subscription": {
    "FreeRequestLimit": 3
  }
}
```

**3. Apply database migrations**
```bash
cd ServiceMarketplace.API
dotnet ef database update
```

**4. Start everything (API + frontend)**
```bash
cd ..
./run.sh
```

- API: `http://localhost:5132`
- Swagger UI: `http://localhost:5132/swagger`
- Frontend: `http://localhost:5173`

---

### Option B — Docker

**1. Set your HuggingFace API key**
```bash
export HUGGINGFACE_API_KEY=hf_your_key_here
```

**2. Start all services**
```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger`

> The database migrations run automatically on API startup via EF Core.

---

## 2. Architecture Overview

```
┌─────────────────────┐         ┌──────────────────────────┐
│   React Frontend    │ ──JWT──▶│    ASP.NET Core 10 API   │
│   (Vite + TS)       │◀─JSON───│    (REST + Swagger)       │
└─────────────────────┘         └───────────┬──────────────┘
                                             │ EF Core
                                             ▼
                                  ┌─────────────────────┐
                                  │   SQL Server (Azure) │
                                  └─────────────────────┘
```

**Request flow:**
1. User logs in → API issues a JWT with `userId`, `email`, `role` claims
2. Frontend stores JWT in `localStorage` via Zustand (persisted)
3. Axios attaches `Authorization: Bearer <token>` on every request
4. `[RequirePermission]` attribute resolves the user's effective permissions before the controller runs
5. Controllers delegate to services → services interact with EF Core → SQL Server

**Layer responsibilities:**
| Layer | Responsibility |
|---|---|
| Controllers | Route HTTP, validate input, return status codes |
| Services | Business logic, state transitions, subscription gating |
| Repositories (via EF Core) | Data access, migrations, seeding |
| Middleware | Global exception handling, never exposes stack traces |

---

## 3. Key Design Decisions & Trade-offs

### JWT over Sessions
Stateless authentication scales horizontally — no session store needed. JWTs carry `userId`, `email`, and `role` claims so the API never looks up the session on every request.

### Haversine over PostGIS
Implemented Haversine in `GeoHelper.cs` with a SQL bounding-box pre-filter. No PostGIS extension required, works on any SQL Server instance. Trade-off: slightly less accurate than PostGIS spherical geometry at very long distances, but sufficient for service marketplace radius queries under 200km.

### Simulated Payments
Subscription tier (`Free` / `Paid`) is a field on the `User` entity, toggled by Admin. No real payment gateway is integrated. In production this would be replaced with Stripe webhooks updating the `SubTier` field on successful payment.

### AI — HuggingFace Inference API (with mock fallback)
Uses `Qwen/Qwen2.5-7B-Instruct-Turbo` via HuggingFace's router. The AI call is isolated to `POST /api/ai/enhance-description` — it is never called automatically on request creation, only when the user explicitly clicks "Enhance with AI" in the UI. If the AI call fails for any reason, the service silently falls back to a keyword-based mock so the user experience is never broken.

### Clean Folder Structure over Full Clean Architecture
Controllers → Services → EF Core directly. Avoids the overhead of repository interfaces, domain events, and application/domain layer separation for an MVP. The trade-off is slightly lower testability in isolation, acceptable for this scope.

---

## 4. RBAC Design

### Four Roles
| Role | Value | Description |
|---|---|---|
| Admin | 0 | Platform superuser — manages users, subscriptions, all permissions |
| ProviderAdmin | 1 | Manages their own org's employee permissions + provider actions |
| ProviderEmployee | 2 | Accept and complete service requests |
| Customer | 3 | Create and view their own service requests |

### Permission Storage
**`RolePermissions` table** — seeded defaults per role:
- `Customer` → `request.create`
- `ProviderAdmin` → `request.accept`, `request.complete`, `request.view_all`
- `ProviderEmployee` → `request.accept`, `request.complete`

**`UserPermissions` table** — dynamic per-user overrides:
- `granted = true` → adds a permission the role doesn't have by default
- `granted = false` → revokes a permission the role has by default

### Permission Resolution (IPermissionService)
```
HasPermission(userId, permissionName):
  1. Load user's role → get role's default permissions from RolePermissions
  2. Load user's overrides from UserPermissions
  3. Apply grants (add) and revokes (remove)
  4. Return true if permissionName is in the final set
```

### Enforcement
Every protected endpoint uses `[RequirePermission("permission.name")]` instead of `[Authorize(Roles="...")]`. The attribute calls `IPermissionService.HasPermission` and returns `403 Forbidden` if denied. This means permissions can be changed at runtime without redeploying.

---

## 5. What I Would Improve With More Time

**Real payment gateway**
Replace the `SubTier` toggle with Stripe webhooks. On successful payment, update `SubTier = Paid`. On subscription cancellation, revert to `Free`.

**SignalR for real-time notifications**
When a provider accepts or completes a request, broadcast a WebSocket event to the customer via a SignalR hub. The customer would see a live toast notification without polling.

**Customer completion confirmation**
Add a `PendingConfirmation` status between `Accepted` and `Completed`. Provider marks complete → customer receives SignalR notification → customer confirms → status becomes `Completed`. Auto-confirm after 24 hours via a background job.

**Audit log table**
Record every permission change (who changed what, when, old value, new value). Critical for compliance and debugging in a production RBAC system.

**Redis cache for permission lookups**
Cache `HasPermission(userId, permissionName)` results in Redis with a short TTL (60s). Invalidate on permission change. This removes a DB round-trip from every protected API call.

**Rate limiting on AI endpoint**
Add ASP.NET Core rate limiting middleware on `POST /api/ai/enhance-description` to prevent abuse of the HuggingFace quota.

**Spatial index for geo queries at scale**
Add a computed geography column with a spatial index for the nearby query. At 100k+ requests, the current bounding-box + Haversine approach would need replacing with `ST_DWithin` (PostGIS) or Redis `GEORADIUS`.

**File uploads for request completion**
Allow providers to attach photos when marking a request complete, stored in Azure Blob Storage. Customers would see proof of work on their completed request cards.
