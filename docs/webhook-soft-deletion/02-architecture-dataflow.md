# Architecture & Data Flow

## 🏗️ Detailed System Architecture

This document provides comprehensive architectural diagrams and data flow explanations for the Webhook Soft Deletion System.

## 🔄 Complete Data Flow Diagram

```mermaid
graph TB
    subgraph "Frontend (React)"
        UI[Webhook Management UI]
        DD[Delete Dialog]
        DP[Deleted Panel]
        UI --> DD
        UI --> DP
    end

    subgraph "Cloudflare Workers API"
        Router[Hono Router]
        WR[Webhook Routes]
        QP[Queue Producer]
        QC[Queue Consumer]

        Router --> WR
        WR --> QP
    end

    subgraph "Cloudflare Queues"
        WDQ[webhook-deletion]
        DLQ[webhook-deletion-dlq]

        QP --> WDQ
        WDQ --> QC
        WDQ -.->|failed jobs| DLQ
    end

    subgraph "Database (D1)"
        WC[webhook_configs]
        WDE[webhook_deletion_events]
        WSD[webhook_scheduled_deletions]

        WR --> WC
        WR --> WDE
        WR --> WSD
        QC --> WC
        QC --> WDE
        QC --> WSD
    end

    %% User interactions
    UI -->|DELETE request| Router
    UI -->|POST restore| Router
    UI -->|GET deleted| Router

    %% Queue processing
    QC -->|24h later| WC

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef queue fill:#fff3e0
    classDef database fill:#e8f5e8

    class UI,DD,DP frontend
    class Router,WR,QP,QC api
    class WDQ,DLQ queue
    class WC,WDE,WSD database
```

## 📊 Detailed Request Flow

### 1. Soft Delete Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend UI
    participant API as Workers API
    participant Q as Cloudflare Queue
    participant DB as D1 Database

    U->>UI: Click Delete Button
    UI->>UI: Show Delete Dialog
    U->>UI: Select Soft Delete + Reason
    UI->>API: DELETE /webhook/{id}?reason=...

    API->>DB: Check webhook exists
    DB-->>API: Webhook data

    API->>DB: Begin transaction
    API->>DB: INSERT into webhook_deletion_events
    API->>DB: UPDATE webhook_configs (soft delete)
    API->>DB: INSERT into webhook_scheduled_deletions
    API->>DB: Commit transaction

    API->>Q: Schedule deletion job (24h delay)
    Q-->>API: Job scheduled

    API-->>UI: Success response with job_id
    UI->>UI: Show success message
    UI->>UI: Refresh webhook list
```

### 2. Restoration Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend UI
    participant API as Workers API
    participant DB as D1 Database

    U->>UI: Open Deleted Webhooks Panel
    UI->>API: GET /webhook/deleted
    API->>DB: SELECT soft deleted webhooks
    DB-->>API: Deleted webhooks with status
    API-->>UI: Deleted webhooks list

    U->>UI: Click Restore Button
    UI->>API: POST /webhook/{id}/restore

    API->>DB: Check restoration eligibility
    DB-->>API: Webhook and job status

    alt Within 24h window
        API->>DB: Begin transaction
        API->>DB: UPDATE webhook_configs (clear deletion)
        API->>DB: UPDATE webhook_scheduled_deletions (cancel)
        API->>DB: INSERT into webhook_deletion_events (restore)
        API->>DB: Commit transaction
        API-->>UI: Success response
        UI->>UI: Show success message
    else Outside 24h window
        API-->>UI: Error: Cannot restore
        UI->>UI: Show error message
    end
```

### 3. Automatic Deletion Flow

```mermaid
sequenceDiagram
    participant Q as Cloudflare Queue
    participant QC as Queue Consumer
    participant DB as D1 Database

    Note over Q: 24 hours pass
    Q->>QC: Trigger webhook deletion job
    QC->>DB: Get webhook and job details
    DB-->>QC: Webhook status and job info

    alt Webhook still marked for deletion
        QC->>DB: Begin transaction
        QC->>DB: DELETE from webhook_configs
        QC->>DB: UPDATE webhook_scheduled_deletions (completed)
        QC->>DB: INSERT into webhook_deletion_events (permanent)
        QC->>DB: Commit transaction
        QC-->>Q: ACK - Job completed
    else Webhook was restored
        QC->>DB: UPDATE webhook_scheduled_deletions (cancelled)
        QC->>DB: INSERT webhook_deletion_events (cancelled)
        QC-->>Q: ACK - Job cancelled
    end
```

## 🏛️ Detailed Component Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend React Application                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Webhooks.tsx  │  │SoftDeleteDialog │  │SoftDeletedPanel │ │
│  │                 │  │                 │  │                 │ │
│  │ • Main UI       │  │ • Confirmation  │  │ • Deleted list  │ │
│  │ • Webhook list  │  │ • Soft/Force    │  │ • Restore UI    │ │
│  │ • Actions       │  │ • Reason input  │  │ • Countdown     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │        │
│           └─────────────────────┼─────────────────────┘        │
│                                 │                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                API Client Layer                         │   │
│  │                                                         │   │
│  │ • DELETE /webhook/{id}                                  │   │
│  │ • POST /webhook/{id}/restore                            │   │
│  │ • GET /webhook/deleted                                  │   │
│  │ • Error handling & loading states                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                      ┌─────────────────┐
                      │  Cloudflare     │
                      │  Workers API    │
                      └─────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Cloudflare Workers Backend                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   index.ts      │  │  webhook.ts     │  │webhook-deletion │ │
│  │                 │  │   (routes)      │  │    .ts (queue)  │ │
│  │ • Hono app      │  │                 │  │                 │ │
│  │ • Middleware    │  │ • DELETE route  │  │ • Producer      │ │
│  │ • Queue export  │  │ • Restore route │  │ • Consumer      │ │
│  │ • CORS setup    │  │ • List deleted  │  │ • Job logic     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │        │
│           └─────────────────────┼─────────────────────┘        │
│                                 │                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Database Layer                           │   │
│  │                                                         │   │
│  │ • Connection management                                 │   │
│  │ • Transaction handling                                 │   │
│  │ • Query optimization                                   │   │
│  │ • Error handling                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                      ┌─────────────────┐
                      │  Cloudflare D1  │
                      │    Database     │
                      └─────────────────┘
```

## 🗄️ Database Entity Relationships

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   webhook_configs   │         │webhook_deletion_    │         │webhook_scheduled_   │
│                     │         │      events         │         │    deletions        │
│ • id (PK)          │◄────────┤                     │         │                     │
│ • webhook_id       │         │ • id (PK)           │         │ • id (PK)           │
│ • name             │         │ • webhook_id (FK)   │         │ • webhook_id (FK)   │
│ • deleted_at       │         │ • event_type        │         │ • job_id (UNIQUE)   │
│ • deletion_job_id  │         │ • event_timestamp   │◄────────┤ • scheduled_at      │
│ • deleted_by       │         │ • user_id          │         │ • execute_at        │
│ • deletion_reason  │         │ • reason           │         │ • status            │
│ • scheduled_       │         │ • metadata         │         │ • attempts          │
│   deletion_at      │         │ • job_id           │         │ • error_message     │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
          │                                                               ▲
          │                                                               │
          └───────────────────────────────────────────────────────────────┘
                              Foreign Key Relationship
```

## 🔄 State Transition Diagrams

### Webhook State Transitions

```
                                    ┌─────────────────┐
                                    │     ACTIVE      │
                                    │                 │
                                    │ deleted_at:     │
                                    │    NULL         │
                                    └─────────────────┘
                                            │
                                            │ DELETE (soft)
                                            ▼
    ┌─────────────────┐              ┌─────────────────┐
    │     ACTIVE      │              │  SOFT_DELETED   │
    │                 │              │                 │
    │ deleted_at:     │◄─────────────┤ deleted_at:     │
    │    NULL         │   RESTORE    │   timestamp     │
    └─────────────────┘              │ job_id: set     │
                                     └─────────────────┘
                                            │
                                            │ 24h timer
                                            │ OR force delete
                                            ▼
                                    ┌─────────────────┐
                                    │ PERMANENTLY_    │
                                    │   DELETED       │
                                    │                 │
                                    │ Record removed  │
                                    │ from database   │
                                    └─────────────────┘
```

### Job State Transitions

```
┌─────────────┐    queue     ┌─────────────┐    execute   ┌─────────────┐
│   PENDING   │─────────────▶│ PROCESSING  │─────────────▶│ COMPLETED   │
└─────────────┘              └─────────────┘              └─────────────┘
       │                            │                            ▲
       │ restore                    │ error                      │ success
       │                            ▼                            │
       │                     ┌─────────────┐    retry           │
       │                     │   FAILED    │────────────────────┘
       │                     └─────────────┘
       │                            │
       │                            │ max retries
       │                            ▼
       │                     ┌─────────────┐
       └────────────────────▶│ CANCELLED   │
                             └─────────────┘
```

## 🚀 Request Processing Flow

### ASCII Request Flow Diagram

```
User Action                API Layer                 Queue Layer               Database Layer
     │                         │                         │                         │
     │ 1. DELETE webhook       │                         │                         │
     ├────────────────────────▶│                         │                         │
     │                         │ 2. Validate request     │                         │
     │                         ├────────────────────────────────────────────────────▶│
     │                         │                         │                         │ 3. Check webhook
     │                         │◄────────────────────────────────────────────────────┤
     │                         │                         │                         │
     │                         │ 4. Start transaction    │                         │
     │                         ├────────────────────────────────────────────────────▶│
     │                         │                         │                         │ 5. Soft delete
     │                         │                         │                         │    webhook
     │                         │                         │                         │ 6. Create event
     │                         │                         │                         │ 7. Create job
     │                         │◄────────────────────────────────────────────────────┤
     │                         │                         │                         │
     │                         │ 8. Schedule queue job   │                         │
     │                         ├────────────────────────▶│                         │
     │                         │                         │ 9. Queue job for 24h   │
     │                         │◄────────────────────────┤                         │
     │                         │                         │                         │
     │                         │ 10. Commit transaction  │                         │
     │                         ├────────────────────────────────────────────────────▶│
     │ 11. Success response    │                         │                         │
     │◄────────────────────────┤                         │                         │
     │                         │                         │                         │
     │                         │    ... 24 hours later ...                        │
     │                         │                         │                         │
     │                         │                         │ 12. Process job        │
     │                         │◄────────────────────────┤                         │
     │                         │                         │                         │
     │                         │ 13. Permanent delete    │                         │
     │                         ├────────────────────────────────────────────────────▶│
     │                         │                         │                         │ 14. Delete webhook
     │                         │                         │                         │     Update job
     │                         │                         │                         │     Log event
     │                         │◄────────────────────────────────────────────────────┤
     │                         │                         │                         │
     │                         │ 15. ACK job completion  │                         │
     │                         ├────────────────────────▶│                         │
     │                         │                         │                         │
```

## 🔧 Component Interaction Matrix

```
┌─────────────────┬─────────┬─────────┬─────────┬─────────┬─────────────┐
│    Component    │Frontend │   API   │  Queue  │Database │ Dependencies│
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ SoftDeleteDialog│    ✓    │    ─    │    ─    │    ─    │ API Client  │
│ DeletedPanel    │    ✓    │    ─    │    ─    │    ─    │ API Client  │
│ Webhooks.tsx    │    ✓    │    ─    │    ─    │    ─    │ Components  │
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ webhook.ts      │    ─    │    ✓    │    ✓    │    ✓    │ Queue Prod. │
│ webhook-del.ts  │    ─    │    ─    │    ✓    │    ✓    │ Queue Cons. │
│ index.ts        │    ─    │    ✓    │    ✓    │    ─    │ Hono Router │
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ Queue Producer  │    ─    │    ✓    │    ✓    │    ✓    │ CF Queues   │
│ Queue Consumer  │    ─    │    ─    │    ✓    │    ✓    │ CF Queues   │
├─────────────────┼─────────┼─────────┼─────────┼─────────┼─────────────┤
│ webhook_configs │    ─    │    ─    │    ─    │    ✓    │ D1 SQLite   │
│ deletion_events │    ─    │    ─    │    ─    │    ✓    │ D1 SQLite   │
│ scheduled_dels  │    ─    │    ─    │    ─    │    ✓    │ D1 SQLite   │
└─────────────────┴─────────┴─────────┴─────────┴─────────┴─────────────┘
```

## 📈 Performance Characteristics

### Latency Expectations

```
Operation Type          │ Expected Latency │ Max Latency │ P95 Target
───────────────────────┼─────────────────┼────────────┼────────────
Soft Delete Request    │      < 200ms     │    500ms   │   300ms
Restore Request        │      < 150ms     │    400ms   │   250ms
List Deleted Webhooks  │      < 300ms     │    800ms   │   500ms
Queue Job Processing   │      < 100ms     │    300ms   │   200ms
Permanent Deletion     │      < 250ms     │    600ms   │   400ms
```

### Scalability Limits

```
Resource               │ Current Limit    │ Cloudflare Limit │ Monitoring
──────────────────────┼─────────────────┼─────────────────┼────────────
Queue Messages/Day     │    Unlimited     │     Unlimited    │ Dashboard
Concurrent Jobs        │       100        │      1,000       │ Logs
Database Connections   │        50        │       100        │ D1 Metrics
API Requests/Min       │     1,000        │     10,000       │ Analytics
Worker CPU Time        │       50ms       │       100ms      │ Observability
```

## 🔒 Security Flow

### Authentication & Authorization

```mermaid
graph TD
    A[API Request] --> B{Auth Header Present?}
    B -->|No| C[Return 401 Unauthorized]
    B -->|Yes| D[Validate API Key/Token]
    D -->|Invalid| C
    D -->|Valid| E[Check User Permissions]
    E -->|Insufficient| F[Return 403 Forbidden]
    E -->|Sufficient| G[Process Request]
    G --> H[Log User Action]
    H --> I[Return Response]
```

### Data Privacy & Audit

```
┌─────────────────────────────────────────────────────────────┐
│                    Security & Audit Layer                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Every operation logs:                                      │
│  • User ID (X-User-ID header)                              │
│  • Timestamp (ISO 8601)                                    │
│  • Action taken                                            │
│  • Resource affected                                       │
│  • Reason provided                                         │
│  • IP address                                              │
│  • User agent                                              │
│                                                             │
│  Data protection:                                          │
│  • Lead data never deleted                                 │
│  • Webhook configs soft deleted only                      │
│  • Complete audit trail maintained                        │
│  • No sensitive data in logs                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Next**: Learn about the [Database Schema](./03-database-schema.md) in detail.