# Zebra BU Mapping Service

The Zebra BU Mapping Service is a backend web service designed to enrich SharePoint Organization data by providing middleware mapping between organizational structure (hierarchy) and derived business group details (Strategic Pillar, Business Unit, Team, etc.) not directly stored in SharePoint. The service queries the Microsoft Graph API using a user's email, traverses the managerial hierarchy, and cross-references its own registry to assign business unit affiliation.

## Tech Stack

- **Language**: TypeScript (Node.js)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Auth Integration**: Microsoft Graph API via MSAL (Azure AD OAuth 2.0)
- **Security**: API Key authentication on all endpoints
- **Logging**: Winston + MongoDB audit log for write operations
- **Testing**: Jest + Supertest
- **Deployment**: Docker + Docker Compose

## Project Structure

```
src/
├── app.ts                    # Express app setup
├── server.ts                 # Entry point (listens on port)
├── config/
│   ├── index.ts              # Config from environment variables
│   └── database.ts           # MongoDB connection
├── models/
│   ├── HierarchyNode.ts      # Hierarchy node schema
│   └── AuditLog.ts           # Audit log schema
├── middleware/
│   ├── auth.ts               # API key authentication
│   └── audit.ts              # Audit logging for writes
├── routes/
│   ├── users.ts              # User routes
│   └── hierarchy.ts          # Hierarchy routes
├── controllers/
│   ├── userController.ts     # User endpoint handlers
│   └── hierarchyController.ts # Hierarchy endpoint handlers
├── services/
│   ├── hierarchyService.ts   # Business logic (CRUD + tree traversal)
│   └── graphService.ts       # Microsoft Graph API integration
└── utils/
    └── logger.ts             # Winston logger
tests/
├── user.test.ts              # Tests for user endpoints
└── hierarchy.test.ts         # Tests for hierarchy endpoints
```

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB 7+ (or use Docker Compose)
- Azure AD app registration (optional – for Graph API integration)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/zebra-bu-mapping
API_KEY=your-api-key-here
AZURE_TENANT_ID=your-tenant-id       # Optional: for Graph API
AZURE_CLIENT_ID=your-client-id       # Optional: for Graph API
AZURE_CLIENT_SECRET=your-client-secret # Optional: for Graph API
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
NODE_ENV=development
```

> **Note:** Azure credentials are optional. Without them, the `/manager` lookup via Microsoft Graph is gracefully skipped.

### Run (Development)

```bash
npm run dev
```

### Build & Run (Production)

```bash
npm run build
npm start
```

### Run with Docker Compose

```bash
docker compose up --build
```

This starts both the app and a MongoDB 7 instance.

### Run Tests

```bash
npm test
```

## Data Model

Hierarchy goes: **Strategic Pillar → Business Unit → Team → Group → Members**

Each node is stored as a flat `HierarchyNode` document in MongoDB:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique node identifier (UUID) |
| `type` | enum | `strategic_pillar`, `business_unit`, `team`, `group` |
| `name` | string | Node name |
| `leader_email` | string | Email of the node's leader |
| `parent_id` | string? | ID of the parent node (null for top-level) |
| `members` | `{ email }[]` | Direct members of this node |

## API Reference

All endpoints require the `x-api-key` header.

### Health Check

```
GET /health
```

Returns `{ "status": "ok", "timestamp": "..." }`.

---

### 1. Get Hierarchy by User Email

```
GET /api/users/{email}/hierarchy
```

Returns the full hierarchy path (Strategic Pillar → BU → Team → Group) for the given user. The user can be a member of a group or a leader of any node.

**Response 200:**
```json
{
  "member_email": "eva.employee@company.com",
  "group": { "id": "GR8001", "name": "Solutions Strategy", "leader_email": "..." },
  "team": { "id": "TM7001", "name": "Artificial Intelligence Solutions", "leader_email": "..." },
  "business_unit": { "id": "BU101", "name": "Workcloud Software Solutions", "leader_email": "..." },
  "strategic_pillar": { "id": "SP001", "name": "Connected Frontline Workers", "leader_email": "..." }
}
```

**Response 404:** User not found in any hierarchy node.

---

### 2. Bulk Get Hierarchy by User Emails

```
POST /api/users/hierarchy/search
Content-Type: application/json

{
  "emails": ["user1@company.com", "user2@company.com"]
}
```

- Max 100 emails per request.
- Returns an array in the same order as the input; `null` for users not found.

**Response 200:** `[ { ...hierarchyPath }, null, ... ]`

---

### 3. Add New Organization Unit

```
POST /api/hierarchy
Content-Type: application/json

{
  "type": "team",
  "name": "New Team Name",
  "leader_email": "leader@company.com",
  "parent_id": "BU101"
}
```

- `type` must be one of: `strategic_pillar`, `business_unit`, `team`, `group`.
- `parent_id` is optional (omit for top-level nodes). If provided, the parent must exist.

**Response 201:** Created node object.

---

### 4. Update Leader for a Node

```
PUT /api/hierarchy/{nodeId}/leader
Content-Type: application/json

{
  "leader_email": "new.leader@company.com"
}
```

**Response 200:** Updated node object.  
**Response 404:** Node not found.

---

### 5. Get All Units by Type

```
GET /api/hierarchy/{type}
```

`type` must be one of: `strategic_pillar`, `business_unit`, `team`, `group`.

**Response 200:** Array of matching nodes.

## Security

- All endpoints require a valid `x-api-key` header; requests without it return `401 Unauthorized`.
- All write operations (`POST`, `PUT`) are audit-logged to the `auditlogs` MongoDB collection.
- Input values are sanitized against NoSQL injection before being used in DB queries.

## Microsoft Graph API Integration

When Azure AD credentials are configured, the service uses MSAL client-credential flow to obtain a Graph API token. This enables `graphService.getManagerChain(email)` to traverse up to 5 levels of management chain via the `GET /users/{email}/manager` endpoint. This data can be used to enrich hierarchy lookups with live SharePoint organizational data.

If Azure credentials are not set, Graph API calls are gracefully skipped (no error).

