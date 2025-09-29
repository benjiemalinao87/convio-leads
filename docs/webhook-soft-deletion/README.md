# Webhook Soft Deletion System Documentation

Welcome to the comprehensive documentation for the Convio Leads Webhook Soft Deletion System. This documentation is designed for new interns and developers to understand the complete architecture, data flow, and implementation details.

## 📋 Table of Contents

1. [System Overview](./01-system-overview.md)
2. [Architecture & Data Flow](./02-architecture-dataflow.md)
3. [Database Schema](./03-database-schema.md)
4. [API Documentation](./04-api-documentation.md)
5. [Frontend Components](./05-frontend-components.md)
6. [Queue System](./06-queue-system.md)
7. [Troubleshooting Guide](./07-troubleshooting.md)
8. [Developer Onboarding](./08-developer-onboarding.md)

## 🎯 Quick Start for New Developers

If you're new to the project, start here:

1. **Read the [System Overview](./01-system-overview.md)** - Understand what the system does and why
2. **Study the [Architecture Diagrams](./02-architecture-dataflow.md)** - Visual understanding of data flow
3. **Review the [Database Schema](./03-database-schema.md)** - Understanding the data model
4. **Follow the [Developer Onboarding](./08-developer-onboarding.md)** - Set up your development environment

## 🧠 System Concepts

### What is Soft Deletion?
Soft deletion is a data safety pattern where records are marked as "deleted" instead of being immediately removed from the database. This provides:

- **Safety**: Prevents accidental data loss
- **Compliance**: Maintains audit trails
- **Recovery**: Allows restoration of "deleted" data
- **User Experience**: Gives users confidence to delete without fear

### Why 24 Hours?
The 24-hour grace period provides:
- Sufficient time to notice accidental deletions
- Business day coverage for most time zones
- Industry standard "undo" window
- Balance between safety and system cleanup

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Cloudflare      │    │  Database (D1)  │
│                 │    │  Workers API     │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │Delete Dialog│ │────│ │DELETE webhook│ │────│ │soft_deleted │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ │   records   │ │
│                 │    │         │        │    │ └─────────────┘ │
│ ┌─────────────┐ │    │         ▼        │    │                 │
│ │Deleted Panel│ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ └─────────────┘ │    │ │ Queue Producer│ │    │ │deletion_jobs│ │
└─────────────────┘    │ └──────────────┘ │    │ └─────────────┘ │
                       │         │        │    └─────────────────┘
┌─────────────────┐    │         ▼        │
│ Cloudflare      │    │ ┌──────────────┐ │
│ Queues          │────│ │Queue Consumer│ │
│                 │    │ │(24h delayed) │ │
│ ┌─────────────┐ │    │ └──────────────┘ │
│ │Deletion Jobs│ │    └──────────────────┘
│ └─────────────┘ │
└─────────────────┘
```

## 🔄 Data Flow Summary

1. **User Action**: User clicks delete on a webhook
2. **Soft Delete**: Webhook marked as deleted, job scheduled
3. **Queue Processing**: 24 hours later, permanent deletion occurs
4. **Recovery Option**: User can restore within 24 hours

## 📁 File Structure

```
webhook-api/webhook-api/
├── src/
│   ├── routes/
│   │   └── webhook.ts              # Main webhook routes with soft delete
│   ├── queue/
│   │   └── webhook-deletion.ts     # Queue consumer and producer
│   └── index.ts                    # Queue consumer export
├── migrations/
│   └── add-webhook-soft-deletion.sql
└── wrangler.jsonc                  # Queue configuration

src/
├── components/webhooks/
│   ├── SoftDeleteDialog.tsx        # Delete confirmation UI
│   └── SoftDeletedWebhooksPanel.tsx # Deleted webhooks management
└── pages/
    └── Webhooks.tsx                # Main webhooks page
```

## 🔧 Technologies Used

- **Backend**: Cloudflare Workers, Hono.js, D1 Database
- **Queue System**: Cloudflare Queues
- **Frontend**: React, TypeScript, shadcn/ui
- **Database**: SQLite (via Cloudflare D1)

## 🚀 Getting Started

For detailed setup instructions, see the [Developer Onboarding Guide](./08-developer-onboarding.md).

## 📞 Support

If you have questions or need help:

1. Check the [Troubleshooting Guide](./07-troubleshooting.md)
2. Review the API documentation for specific endpoints
3. Consult the team lead or senior developers

---

**Next**: Start with the [System Overview](./01-system-overview.md) to understand the fundamental concepts.