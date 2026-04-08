# Service Marketplace Platform — Full Implementation Roadmap

## Project Overview
Build a Service Marketplace MVP where customers create service requests, providers accept nearby requests, the system enforces role-based access control with dynamic permissions, subscription gating limits free users, and an AI feature enhances request descriptions.

## Tech Stack

### Backend
- Framework: ASP.NET Core 10 Web API
- ORM: Entity Framework Core 10
- Database: Microsoft SQL Server (Azure SQL)
- Auth: ASP.NET Core Identity + JWT Bearer
- Validation: FluentValidation
- Mapping: Mapster
- API Docs: Swashbuckle (Swagger UI)
- AI Feature: OpenAI SDK for .NET (or mock)
- Containerization: Docker + docker-compose

### Frontend
- Scaffold: Vite + React 18 + TypeScript
- UI: shadcn/ui + Tailwind CSS
- Routing: React Router v6
- Server State: TanStack Query (React Query)
- Forms: React Hook Form + Zod
- HTTP Client: Axios
- Auth State: Zustand

## Solution Structure

```
ServiceMarketplace/
├── ServiceMarketplace.API/
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── RequestsController.cs
│   │   ├── AdminController.cs
│   │   ├── AiController.cs
│   │   └── OrgController.cs
│   ├── Models/
│   │   ├── Entities/
│   │   │   ├── User.cs
│   │   │   ├── ServiceRequest.cs
│   │   │   ├── Organization.cs
│   │   │   ├── Permission.cs
│   │   │   ├── RolePermission.cs
│   │   │   └── UserPermission.cs
│   │   ├── DTOs/
│   │   │   ├── Auth/
│   │   │   ├── Requests/
│   │   │   ├── Admin/
│   │   │   └── Ai/
│   │   └── Enums/
│   │       ├── UserRole.cs
│   │       ├── RequestStatus.cs
│   │       └── SubscriptionTier.cs
│   ├── Data/
│   │   ├── AppDbContext.cs
│   │   └── Migrations/
│   ├── Services/
│   │   ├── Interfaces/
│   │   │   ├── IAuthService.cs
│   │   │   ├── IRequestService.cs
│   │   │   ├── IPermissionService.cs
│   │   │   ├── ISubscriptionService.cs
│   │   │   └── IAiService.cs
│   │   ├── AuthService.cs
│   │   ├── RequestService.cs
│   │   ├── PermissionService.cs
│   │   ├── SubscriptionService.cs
│   │   └── AiService.cs
│   ├── Middleware/
│   │   ├── ExceptionMiddleware.cs
│   │   └── RequirePermissionAttribute.cs
│   ├── Helpers/
│   │   └── GeoHelper.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Program.cs
│   └── ServiceMarketplace.API.csproj
├── ServiceMarketplace.Client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── hooks/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

---

## Database Schema

### Users table
```
id             uuid         PK
email          nvarchar     unique, required
passwordHash   nvarchar     required
role           int (enum)   Admin=0, ProviderAdmin=1, ProviderEmployee=2, Customer=3
subTier        int (enum)   Free=0, Paid=1
organizationId uuid         FK -> Organizations (nullable, for Provider roles)
createdAt      datetime
```

### ServiceRequests table
```
id                   uuid
customerId           uuid         FK -> Users
title                nvarchar     required
description          nvarchar     required
category             nvarchar
latitude             decimal(9,6) required
longitude            decimal(9,6) required
status               int (enum)   Pending=0, Accepted=1, Completed=2
acceptedByProviderId uuid         FK -> Users (nullable)
createdAt            datetime
updatedAt            datetime
```

### Organizations table
```
id        uuid
name      nvarchar
ownerId   uuid   FK -> Users (ProviderAdmin)
createdAt datetime
```

### Permissions table (seeded, not user-created)
```
id   int
name nvarchar
```
Seed these exact four permission names:
- request.create
- request.accept
- request.complete
- request.view_all

### RolePermissions table
```
role         int (enum)
permissionId int   FK -> Permissions
```
Default seeds:
- Customer        -> request.create
- ProviderAdmin   -> request.accept, request.complete, request.view_all
- ProviderEmployee-> request.accept, request.complete

### UserPermissions table (dynamic overrides)
```
userId       uuid   FK -> Users
permissionId int    FK -> Permissions
granted      bool
```
Effective permission = role default UNION user-level grants, MINUS user-level revokes.

---

## Roles & RBAC Design

### Four roles
1. Admin — full access, manages all users and permissions
2. ProviderAdmin — manages their own organization's ProviderEmployee permissions
3. ProviderEmployee — limited provider access based on assigned permissions
4. Customer — creates and views own requests, gated by subscription

### Permission resolution logic (IPermissionService)
```
HasPermission(userId, permissionName):
  1. Get user's role
  2. Load role's default permissions from RolePermissions
  3. Load user's overrides from UserPermissions
  4. Apply: granted overrides add, revoked overrides remove
  5. Return true if permissionName is in final set
```

### RequirePermission attribute
Every protected endpoint uses [RequirePermission("permission.name")] instead of hardcoded [Authorize(Roles="...")]. This is enforced at the API middleware level, not the UI.

---

## API Endpoints

### Auth
```
POST /api/auth/register    body: { email, password, role }
POST /api/auth/login       body: { email, password }  returns: { token, role, userId }
```

### Service Requests
```
POST   /api/requests                              requires: request.create, Customer only, subscription gated
GET    /api/requests                              role-filtered: Customer=own, Provider=all pending, Admin=all
GET    /api/requests/{id}                         ownership or role check
GET    /api/requests/nearby?lat=&lng=&radiusKm=   requires: request.view_all, Provider only
PATCH  /api/requests/{id}/accept                  requires: request.accept — 409 if already accepted
PATCH  /api/requests/{id}/complete                requires: request.complete — 403 if not the acceptor
```

### AI
```
POST /api/ai/enhance-description   body: { title, rawDescription }  returns: { enhancedDescription, suggestedCategory }
```

### Admin
```
GET   /api/admin/users                          Admin only
PATCH /api/admin/users/{id}/subscription        Admin only — toggles Free/Paid
PATCH /api/admin/users/{id}/permissions         Admin only — assigns/revokes permissions
```

### Org (Bonus RBAC)
```
GET   /api/org/members                          ProviderAdmin only — own org members
PATCH /api/org/members/{id}/permissions         ProviderAdmin only — manage employee permissions
```

---

## HTTP Status Codes (must be exact)

- 200 OK — successful read
- 201 Created — successful create
- 400 Bad Request — validation failure (FluentValidation)
- 401 Unauthorized — no/invalid JWT
- 403 Forbidden — valid JWT but insufficient role/permission OR subscription limit reached
- 404 Not Found — resource does not exist
- 409 Conflict — duplicate accept (request already accepted)
- 422 Unprocessable Entity — invalid state transition (e.g. pending->completed)
- 500 Internal Server Error — unhandled (caught by ExceptionMiddleware, never exposes stack trace)

---

## Request Lifecycle State Machine

Valid transitions only:
- Pending   -> Accepted   (via /accept, Provider only)
- Accepted  -> Completed  (via /complete, same Provider who accepted)

Invalid transitions (return 422):
- Pending   -> Completed  (skip accepted)
- Accepted  -> Pending    (reverse)
- Completed -> anything   (terminal state)

---

## Subscription Gating Logic

On POST /api/requests:
1. Check user role is Customer
2. Check user subTier
3. If Free: count existing requests by this customer
4. If count >= 3: return 403 with message "Free tier limit reached. Upgrade to create more requests."
5. If Paid or count < 3: proceed

---

## Geolocation — Haversine Formula

No PostGIS required. Implement in GeoHelper.cs:
```csharp
public static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
{
    const double R = 6371; // Earth radius in km
    var dLat = ToRad(lat2 - lat1);
    var dLon = ToRad(lon2 - lon1);
    var a = Math.Sin(dLat/2) * Math.Sin(dLat/2) +
            Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
            Math.Sin(dLon/2) * Math.Sin(dLon/2);
    var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1-a));
    return R * c;
}
private static double ToRad(double deg) => deg * Math.PI / 180;
```

In the nearby query: first apply a bounding box filter in SQL (fast), then apply Haversine in memory (accurate):
```
lat between (userLat - km/111) and (userLat + km/111)
AND lng between (userLng - km/111) and (userLng + km/111)
```
Then filter results by exact Haversine distance <= radiusKm.

---

## Phase 1 — Auth & Project Setup (Day 1)

Tasks:
1. Create solution: dotnet new sln -n ServiceMarketplace
2. Create API project: dotnet new webapi -n ServiceMarketplace.API --framework net10.0
3. Install NuGet packages:
   - Microsoft.EntityFrameworkCore.SqlServer
   - Microsoft.EntityFrameworkCore.Tools
   - Microsoft.AspNetCore.Authentication.JwtBearer
   - Microsoft.AspNetCore.Identity.EntityFrameworkCore
   - FluentValidation.AspNetCore
   - Mapster
   - Swashbuckle.AspNetCore
   - OpenAI (or mock)
4. Create AppDbContext extending IdentityDbContext<User>
5. Create all entity models (User, ServiceRequest, Organization, Permission, RolePermission, UserPermission)
6. Create all enums (UserRole, RequestStatus, SubscriptionTier)
7. Configure JWT in Program.cs
8. Implement POST /api/auth/register
9. Implement POST /api/auth/login returning JWT with claims: userId, email, role
10. Seed roles, permissions (4 exact names), and RolePermissions defaults in OnModelCreating
11. Add initial EF migration and update database
12. Configure Swagger with JWT Bearer button

---

## Phase 2 — RBAC System (Day 2)

Tasks:
1. Create IPermissionService and PermissionService implementing the resolution logic above
2. Create RequirePermissionAttribute — reads permission name, calls IPermissionService, returns 403 if denied
3. Register PermissionService in DI container
4. Create UserPermissions table operations (add/remove/list per user)
5. Implement PATCH /api/admin/users/{id}/permissions (Admin assigns/revokes)
6. Implement GET /api/admin/users (Admin lists all users)
7. Implement PATCH /api/admin/users/{id}/subscription (Admin toggles Free/Paid)
8. Implement GET /api/org/members (ProviderAdmin sees own org members)
9. Implement PATCH /api/org/members/{id}/permissions (ProviderAdmin manages employee permissions — scoped to own org only)
10. Write RBAC section of README now while logic is fresh

---

## Phase 3 — Core API: Requests, Geo, Subscription (Day 3)

Tasks:
1. Create IRequestService and RequestService
2. Implement POST /api/requests with:
   - [RequirePermission("request.create")]
   - Subscription gating check (Free tier max 3)
   - FluentValidation: title required max 200 chars, description required min 10 chars max 2000, lat -90..90, lng -180..180
3. Implement GET /api/requests with role-based filtering
4. Implement GET /api/requests/{id} with ownership check
5. Implement GET /api/requests/nearby with Haversine (bbox pre-filter + exact distance)
6. Implement PATCH /api/requests/{id}/accept:
   - [RequirePermission("request.accept")]
   - Return 409 if status != Pending
   - Set status = Accepted, set acceptedByProviderId
7. Implement PATCH /api/requests/{id}/complete:
   - [RequirePermission("request.complete")]
   - Return 403 if current user is not the acceptor
   - Return 422 if status != Accepted
   - Set status = Completed
8. Create ExceptionMiddleware for global error handling (log + return ProblemDetails, never stack trace)
9. Register ExceptionMiddleware in Program.cs
10. Create GeoHelper.cs with Haversine implementation

---

## Phase 4 — AI Feature + Swagger Export (Day 4)

Tasks:
1. Create IAiService and AiService
2. Implement POST /api/ai/enhance-description:
   - Call OpenAI chat completion OR return mock enhanced description
   - Mock fallback: prepend "Professional service: " to description, categorize by keywords
   - Wrap in try/catch — AI failure must not break request creation
3. Add XML doc comments (/// <summary>) to all controllers and DTOs
4. Configure Swagger to read XML comments
5. Export swagger.json: dotnet run -> GET /swagger/v1/swagger.json -> save to repo root
6. Test every endpoint in Swagger UI before moving to frontend
7. Add appsettings entries: ConnectionStrings:DefaultConnection, Jwt:Key, Jwt:Issuer, Jwt:Audience, OpenAI:ApiKey
8. Ensure no secrets are hardcoded — all from appsettings / environment variables

---

## Phase 5 — Frontend: Auth + Customer Flow (Day 5)

Tasks:
1. Scaffold: npm create vite@latest ServiceMarketplace.Client -- --template react-ts
2. Install packages: shadcn/ui, tailwindcss, react-router-dom, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, axios, zustand
3. Create Axios instance (src/api/axios.ts):
   - baseURL from env var VITE_API_URL
   - Request interceptor: attach JWT from Zustand store
   - Response interceptor: on 401 clear auth store and redirect to /login
4. Create Zustand auth store (src/store/authStore.ts):
   - state: token, userId, email, role
   - actions: login, logout
   - persist to localStorage
5. Create ProtectedRoute component — redirect to /login if not authenticated, check role if roleRequired prop passed
6. Create Login page with React Hook Form + Zod validation
7. Create Register page with role selector (Customer / ProviderEmployee / ProviderAdmin)
8. Create Customer dashboard with:
   - Create Request form: title, description (with "✨ Enhance" button calling /api/ai/enhance-description), lat/lng inputs, category
   - My Requests list: cards with title, status badge (pending=amber, accepted=blue, completed=green)
   - Free tier limit message when 403 received from POST /api/requests
9. TanStack Query for all data fetching with loading spinners and error states
10. Role-based navigation: Customer sees only Customer routes

---

## Phase 6 — Frontend: Provider + Admin (Day 6)

Tasks:
1. Create Provider dashboard with:
   - Available Requests list: all pending requests
   - Nearby Filter: lat/lng inputs + radius slider -> calls GET /api/requests/nearby
   - Accept button: calls PATCH /accept, shows friendly message on 409
   - My Active Requests: accepted requests list
   - Complete button: calls PATCH /complete, invalidates TanStack Query cache on success
2. Create Admin panel with:
   - Users table: email, role, subscription tier
   - Toggle subscription button per user
   - Permission editor: checkbox list of 4 permissions per user
3. Create ProviderAdmin org panel with:
   - Org members list
   - Permission editor scoped to own org members
4. Add toast notifications (shadcn/ui Sonner) on all success/error actions
5. Add empty states on all list views
6. Add loading skeletons on all data fetching views
7. Ensure role-based nav shows only relevant links per role

---

## Phase 7 — Docker, README, Final Deliverables (Day 7)

Tasks:

### Docker
1. Create Dockerfile for API (multi-stage: mcr.microsoft.com/dotnet/sdk:10.0 build -> mcr.microsoft.com/dotnet/aspnet:10.0 runtime)
2. Create Dockerfile for frontend (node:20 build -> nginx:alpine serve)
3. Create docker-compose.yml with services: api, db (mcr.microsoft.com/mssql/server:2022-latest), frontend
4. Test: docker compose up --build runs full stack from scratch

### README — all 5 required sections (mandatory)
1. Setup instructions: prerequisites, clone, env vars, dotnet ef database update, dotnet run, npm run dev
2. Architecture overview: how layers connect, how JWT flows, how DB is structured
3. Key design decisions and trade-offs:
   - JWT over sessions (stateless, scales horizontally)
   - Haversine over PostGIS (no extension dependency, sufficient for MVP, document accuracy trade-off)
   - Simulated payments (subscriptionTier field on User, toggled by Admin)
   - Mock vs real AI (document which you chose and why)
   - Clean folder structure over full Clean Architecture (avoids over-engineering per assignment guidance)
4. RBAC design explanation:
   - How permissions are stored (RolePermissions defaults + UserPermissions overrides)
   - How IPermissionService resolves effective permissions
   - How [RequirePermission] enforces at API level
   - The four roles and their hierarchy
5. What you would improve with more time:
   - Real payment gateway (Stripe)
   - SignalR for real-time request notifications to providers
   - Audit log table for permission changes
   - Rate limiting on AI endpoint
   - Redis cache for permission lookups
   - Spatial index for geo queries at scale

### Final checklist
- [ ] All 4 exact permission names seeded: request.create, request.accept, request.complete, request.view_all
- [ ] swagger.json committed to repo root
- [ ] .env and appsettings secrets not committed (.gitignore includes appsettings.Development.json and .env)
- [ ] All 5 README sections written
- [ ] Edge cases tested: 409 on duplicate accept, 403 on subscription limit, 422 on invalid transition, 403 on wrong role
- [ ] Repo is public or shared with evaluator
- [ ] Clean commit history (not one giant commit)

---

## Edge Cases to Handle (Graded)

1. Provider tries to accept a request that is already Accepted -> 409 Conflict
2. Provider tries to complete a request they did not accept -> 403 Forbidden
3. Customer on Free tier tries to create 4th request -> 403 Forbidden with clear message
4. Status transition skip: pending -> completed (no accept step) -> 422 Unprocessable Entity
5. Completed request cannot be modified -> 422 Unprocessable Entity
6. Provider tries to create a request -> 403 Forbidden (no request.create permission)
7. Customer tries to call /nearby -> 403 Forbidden (no request.view_all permission)
8. ProviderAdmin tries to edit permissions of a user outside their org -> 403 Forbidden
9. Invalid lat/lng values (out of range) -> 400 Bad Request
10. Missing required fields -> 400 Bad Request with field-level validation errors

---

## Interview Prep — Scale Questions

Q: How would you scale nearby queries for 100,000 providers?
A: Add a spatial index on lat/lng columns. Move to Redis GEORADIUS for in-memory geo queries. Add read replicas for the query workload. At very large scale, use PostGIS with a proper spatial index (ST_DWithin).

Q: How would you scale subscription gating?
A: Replace the synchronous DB count check with an event-driven approach — publish a RequestCreated event, a background job increments a Redis counter per user, the API checks the counter. This removes the DB round-trip from the hot path.

Q: How would you make RBAC more scalable?
A: Cache permission lookups in Redis with a short TTL (e.g. 60s). For a larger system, extract permissions into a dedicated policy service (similar to OPA — Open Policy Agent). Invalidate cache on permission change.

Q: Why .NET over Node for this?
A: Strong typing catches errors at compile time, EF Core with Identity gives auth and ORM out of the box, ASP.NET Core's middleware pipeline is clean for cross-cutting concerns like permission checks, and .NET 10 performance is excellent.

Q: How would you add real-time notifications?
A: Add SignalR hub. When a Customer creates a request, broadcast to all connected Providers in the nearby radius. Providers subscribe to a geo-fenced channel on connect.

Q: How would you handle the AI feature in production?
A: Add a queue (Azure Service Bus or Hangfire) between the request creation and the AI enhancement call. Store the enhanced description asynchronously. Show "enhancing..." state in the UI until the job completes. This prevents AI latency from blocking the user.

---

## NuGet Packages — Backend

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="10.*" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.*" />
<PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.*" />
<PackageReference Include="FluentValidation.AspNetCore" Version="11.*" />
<PackageReference Include="Mapster" Version="7.*" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.*" />
<PackageReference Include="OpenAI" Version="2.*" />
```

## npm Packages — Frontend

```
npm install react-router-dom @tanstack/react-query axios zustand
npm install react-hook-form zod @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer
npx shadcn@latest init
```

---

## appsettings.json Structure

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=ServiceMarketplaceDb;..."
  },
  "Jwt": {
    "Key": "your-secret-key-min-32-chars",
    "Issuer": "ServiceMarketplace",
    "Audience": "ServiceMarketplaceClient",
    "ExpiryMinutes": 1440
  },
  "OpenAI": {
    "ApiKey": "sk-..."
  },
  "Subscription": {
    "FreeRequestLimit": 3
  }
}
```

---

## Program.cs Registration Order

1. Add DbContext with SQL Server connection string
2. Add Identity (IdentityUser -> User)
3. Add JWT Authentication
4. Add Authorization with permission policies
5. Add FluentValidation
6. Add Swagger with JWT support
7. Add CORS for frontend origin
8. Register all services (IAuthService, IRequestService, IPermissionService, ISubscriptionService, IAiService)
9. app.UseExceptionMiddleware()
10. app.UseAuthentication()
11. app.UseAuthorization()
12. app.MapControllers()