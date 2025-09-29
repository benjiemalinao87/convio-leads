# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Codebase Overview

This is the **Convio Leads Management System** - a full-stack application for managing lead data from multiple webhook sources. It consists of two main components:

### Frontend (React + Vite)
- **Location**: Root directory (`/`)
- **Tech Stack**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui, React Router
- **Purpose**: Dashboard interface for viewing, managing, and analyzing leads and contacts

### Backend (Cloudflare Workers API)
- **Location**: `webhook-api/webhook-api/`
- **Tech Stack**: Hono.js, TypeScript, Cloudflare Workers, D1 Database
- **Purpose**: Webhook API for receiving lead data from third-party providers
- **Production URL**: `https://api.homeprojectpartners.com`

## Essential Commands

### Frontend Development
```bash
# Development server (runs on http://localhost:8082 typically)
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Run linter
npm run lint

# Preview production build
npm run preview
```

### Backend API Development
```bash
# Navigate to API directory
cd webhook-api/webhook-api

# Local development server
npm run dev
# or
wrangler dev

# Build (TypeScript compilation check)
npm run build

# Deploy to Cloudflare Workers
npm run deploy
# or
wrangler deploy

# Run tests
npm run test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a single test file
npx vitest src/routes/appointments.test.ts

# Run tests matching a pattern
npx vitest -t "routing logic"

# Validate build and tests together
npm run validate

# View logs from production
npm run logs

# View logs from production environment
npm run logs:production

# Generate TypeScript types for Cloudflare Workers
npm run cf-typegen

# Deploy to specific environments
npm run deploy:production
npm run deploy:staging

# Manage secrets
npm run secret:set WEBHOOK_SECRET
npm run secret:list
```

### Database Operations (D1)
```bash
cd webhook-api/webhook-api

# List databases
wrangler d1 list

# Execute SQL on remote database
wrangler d1 execute convio-leads --remote --command "SELECT COUNT(*) FROM leads;"

# Execute SQL on local database
wrangler d1 execute convio-leads --command "SELECT COUNT(*) FROM leads;"

# Run migration files (example)
wrangler d1 execute convio-leads --remote --file=schema.sql
wrangler d1 execute convio-leads --remote --file=migrations/add-webhook-soft-deletion.sql

# Check table structure
wrangler d1 execute convio-leads --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_configs';"
```

## Architecture Details

### Data Flow Architecture
The system uses a **contact-lead relationship model** to prevent duplicate contacts while preserving all business opportunities:

1. **Contacts** represent unique people (identified by phone number per webhook)
2. **Leads** represent individual business inquiries that belong to contacts
3. **Phone Number Normalization**: All phone numbers are normalized to `+1XXXXXXXXXX` format
4. **Deduplication Logic**: Same phone number from same webhook = same contact, new lead added

### Core Business Models

#### Appointment-as-a-Service (AaaS)
The system operates on an **appointment-as-a-service model** where qualified appointments are sold to client workspaces:

1. **Appointment Routing**: Incoming appointments are automatically routed to client workspaces based on:
   - Product type matching (solar, roofing, HVAC, etc.)
   - Zip code coverage areas
   - Workspace priority and capacity
2. **Revenue Tracking**: Each routed appointment generates tracked revenue
3. **Webhook Forwarding**: Successful appointments are forwarded to client webhook endpoints
4. **History Tracking**: Complete audit trail of routing decisions and webhook delivery

#### Provider Authentication System
Multi-layered authentication for lead source providers:

1. **API Key Authentication**: Each provider gets unique API key
2. **Authorization Header**: Standard `Authorization: Bearer <api_key>` format
3. **Rate Limiting**: Configurable per-provider rate limits
4. **Webhook Allowlisting**: Optional webhook endpoint restrictions
5. **Usage Tracking**: Complete provider activity logs

#### Workspace Routing Logic
Complex routing system for appointment distribution:

1. **Product Matching**: JSON-based product type configuration
2. **Zip Code Ranges**: CSV upload support for bulk zip code management
3. **Priority System**: Workspace priority ordering with overflow
4. **Capacity Management**: Workspace-specific capacity limits
5. **Fallback Rules**: Default workspace for unmatched appointments

### Frontend Architecture
- **State Management**: useState + Context API for auth
- **API Integration**: Direct fetch calls to `https://api.homeprojectpartners.com`
- **Contact Grouping**: Frontend groups leads by `contact_id` to display as "contacts"
- **Diagram Support**: Mermaid.js integration for flowcharts and diagrams
- **Route Structure**:
  - `/` - Dashboard overview
  - `/leads` - Leads/Contacts management (main working area)
  - `/contact/:id` - Detailed contact view with lead history
  - `/appointments` - Appointment management and routing configuration
  - `/conversions` - Revenue tracking and conversion analytics
  - `/analytics` - Lead analytics and reporting
  - `/webhooks` - Webhook configuration and testing
  - `/docs` - Embedded API documentation with mermaid diagrams
  - `/settings` - User settings and workspace management

### Backend Architecture
- **Entry Point**: `src/index.ts` - Hono app with middleware setup
- **Route Organization**:
  - `/health` - Health check endpoints
  - `/webhook` - Webhook management and data ingestion
  - `/leads` - Lead/contact CRUD operations
  - `/appointments` - Appointment-as-a-Service routing system
  - `/conversions` - Revenue tracking and analytics
  - `/routing-rules` - Appointment routing configuration
  - `/providers` - Lead source provider management
  - `/contacts` - Contact-specific operations and queries
  - `/auth` - Authentication endpoints for login/logout
- **Database**: Cloudflare D1 (SQLite) with 21+ tables including:
  - `contacts` - Unique contacts by phone+webhook
  - `leads` - Individual lead records linked to contacts
  - `appointments` - Appointment records with routing
  - `conversions` - Revenue and conversion tracking
  - `workspaces` - Client workspace configuration
  - `appointment_routing_rules` - Routing logic by product/zip
  - `lead_source_providers` - Provider authentication and management
  - `webhook_configs` - Webhook configuration with soft deletion support
  - `webhook_scheduled_deletions` - Queue jobs for delayed deletion
  - `webhook_deletion_events` - Audit trail for webhook lifecycle
  - `*_events` tables - Comprehensive audit trail
  - `*_analytics_cache` tables - Performance optimization

### Key Files and Their Purpose

**Frontend:**
- `src/pages/Leads.tsx` - Main leads management interface with contact grouping logic
- `src/pages/Appointments.tsx` - Appointment management and routing configuration
- `src/pages/ConversionDashboard.tsx` - Revenue tracking and conversion analytics
- `src/pages/ContactDetail.tsx` - Detailed contact view with lead history
- `src/pages/Documentation.tsx` - Embedded API documentation with mermaid diagrams
- `src/components/leads/LeadsTable.tsx` - Table component for displaying contacts/leads
- `src/components/ApiDocumentation.tsx` - Interactive API documentation component
- `src/data/leadsData.ts` - Lead type definitions and interfaces

**Backend:**
- `src/routes/appointments.ts` - Appointment-as-a-Service routing system (600+ lines)
- `src/routes/leads.ts` - Lead/contact CRUD operations including delete endpoints
- `src/routes/conversions.ts` - Revenue tracking and conversion analytics
- `src/routes/providers.ts` - Provider authentication and management
- `src/routes/routing-rules.ts` - Appointment routing configuration
- `src/routes/webhook.ts` - Webhook ingestion and processing (with soft deletion)
- `src/routes/auth.ts` - User authentication endpoints
- `src/db/leads.ts` - Database operations for leads
- `src/db/contacts.ts` - Database operations for contacts with deduplication logic
- `src/queue/webhook-deletion.ts` - Cloudflare Queue handler for delayed deletion

### Foreign Key Constraints
The database has foreign key relationships that require careful deletion ordering:
1. Delete `lead_events` first
2. Delete `contact_events`
3. Delete `leads`
4. Delete `contacts` last

The DELETE endpoints in `src/routes/leads.ts` handle this automatically.

### API Documentation
- **Markdown**: `webhook-api/API_DOCUMENTATION.md` - Comprehensive API documentation
- **Interactive**: Frontend includes embedded API documentation component
- **Endpoints**: 30+ total endpoints including health, webhook, lead management, conversions, and appointments
- **Testing**: Use the `/webhooks` page in frontend for interactive webhook testing

## Environment Configuration

### Frontend Environment
- Development server auto-assigns ports (typically 8082)
- API base URL is hardcoded to production: `https://api.homeprojectpartners.com`

### Backend Environment
- **Cloudflare Account ID**: Configured in `wrangler.jsonc`
- **D1 Database**: `convio-leads` (binding: `LEADS_DB`)
- **Environment Variables**:
  - `ENVIRONMENT`: "development"
  - `API_VERSION`: "1.0.0"
  - `WEBHOOK_SECRET`: Optional for signature validation

## Testing and Quality

### Frontend
- ESLint configuration with React hooks and TypeScript rules
- Build process validates TypeScript compilation
- No formal test suite currently

### Backend
- Vitest for unit testing
- `npm run validate` runs build + tests
- Comprehensive error handling and validation
- Phone number normalization testing

## Important Business Logic

### Appointment Routing Algorithm
The core routing function `findMatchingWorkspace()` in `src/routes/appointments.ts:200+` implements:

1. **Phone Normalization**: Always normalize to `+1XXXXXXXXXX` format for deduplication
2. **Product Type Matching**: JSON array matching against workspace product types
3. **Zip Code Validation**: Priority-based matching with workspace coverage areas
4. **Workspace Priority**: Ordered routing with capacity-aware overflow
5. **Fallback Logic**: Default workspace assignment for unmatched criteria

### Provider Authentication Flow
Standard authentication using `Authorization` header (changed from `lead_source_provider_id`):

1. **Header Format**: `Authorization: Bearer <provider_api_key>`
2. **Validation**: Provider lookup in `lead_source_providers` table
3. **Rate Limiting**: Per-provider configurable limits (default: 1000/hour)
4. **Webhook Restrictions**: Optional allowlisted webhook endpoints
5. **Activity Logging**: All provider actions logged in `provider_usage_log`

### Revenue Tracking System
Conversion tracking across the appointment pipeline:

1. **Lead Value**: Tracked from initial lead capture
2. **Appointment Value**: Revenue generated when appointment is routed
3. **Conversion Rates**: Analytics by provider, workspace, and time period
4. **Cache Optimization**: Pre-computed analytics in `*_analytics_cache` tables

### Data Integrity Rules
Critical constraints for system reliability:

1. **Foreign Key Cascade**: Delete events → contacts → leads → appointments (proper order)
2. **Phone Deduplication**: Same phone + webhook = same contact, new lead appended
3. **Workspace Validation**: All appointments must route to valid workspace
4. **Provider Authentication**: All webhook calls must include valid API key
5. **Audit Trail**: Every action logged in corresponding `*_events` table

### Webhook Soft Deletion System
24-hour delayed deletion with restoration capability:

1. **Soft Delete**: Marks webhook as deleted, schedules permanent deletion after 24 hours
2. **Queue Integration**: Uses Cloudflare Queues for scheduled deletion processing
3. **Restoration**: Webhooks can be restored within 24-hour grace period
4. **Audit Trail**: All deletion/restoration events logged in `webhook_deletion_events`
5. **Fallback Cron**: Hourly cron job ensures deletions process even if queue fails

## Important Notes

- **Delete Functionality**: Implements both individual lead deletion (`DELETE /leads/:leadId`) and contact deletion with cascade (`DELETE /leads/contact/:contactId`)
- **Phone Normalization**: Critical for deduplication - always normalize to +1 format
- **Contact vs Lead**: Frontend displays "contacts" but these are actually grouped leads - be mindful when implementing new features
- **Database Schema**: Follows contact-lead relationship model, not just individual leads
- **API Documentation**: Must be updated in both `API_DOCUMENTATION.md` AND `ApiDocumentation.tsx` component
- **Appointment Routing**: Core business value - routing logic must maintain workspace capacity and priority rules
- **Provider Management**: All webhook authentication migrated to standard `Authorization` header format