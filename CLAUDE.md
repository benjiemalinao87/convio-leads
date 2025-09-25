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

# View logs from production
npm run logs

# Generate TypeScript types for Cloudflare Workers
npm run cf-typegen
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
```

## Architecture Details

### Data Flow Architecture
The system uses a **contact-lead relationship model** to prevent duplicate contacts while preserving all business opportunities:

1. **Contacts** represent unique people (identified by phone number per webhook)
2. **Leads** represent individual business inquiries that belong to contacts
3. **Phone Number Normalization**: All phone numbers are normalized to `+1XXXXXXXXXX` format
4. **Deduplication Logic**: Same phone number from same webhook = same contact, new lead added

### Frontend Architecture
- **State Management**: useState + Context API for auth
- **API Integration**: Direct fetch calls to `https://api.homeprojectpartners.com`
- **Contact Grouping**: Frontend groups leads by `contact_id` to display as "contacts"
- **Route Structure**:
  - `/` - Dashboard overview
  - `/leads` - Leads/Contacts management (main working area)
  - `/analytics` - Analytics and reporting
  - `/webhooks` - Webhook configuration
  - `/settings` - User settings

### Backend Architecture
- **Entry Point**: `src/index.ts` - Hono app with middleware setup
- **Route Organization**:
  - `/health` - Health check endpoints
  - `/webhook` - Webhook management and data ingestion
  - `/leads` - Lead/contact CRUD operations
- **Database**: Cloudflare D1 (SQLite) with tables:
  - `contacts` - Unique contacts by phone+webhook
  - `leads` - Individual lead records linked to contacts
  - `lead_events`, `contact_events` - Audit trail
  - `webhook_configs` - Webhook configuration

### Key Files and Their Purpose

**Frontend:**
- `src/pages/Leads.tsx` - Main leads management interface with contact grouping logic
- `src/components/leads/LeadsTable.tsx` - Table component for displaying contacts/leads
- `src/components/ApiDocumentation.tsx` - Embedded API documentation
- `src/data/leadsData.ts` - Lead type definitions and interfaces

**Backend:**
- `src/routes/leads.ts` - Lead/contact CRUD operations including delete endpoints
- `src/routes/webhook.ts` - Webhook ingestion and processing
- `src/db/leads.ts` - Database operations for leads
- `src/db/contacts.ts` - Database operations for contacts with deduplication logic

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
- **Endpoints**: 22 total endpoints including health, webhook, and lead management

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

## Important Notes

- **Delete Functionality**: Implements both individual lead deletion (`DELETE /leads/:leadId`) and contact deletion with cascade (`DELETE /leads/contact/:contactId`)
- **Phone Normalization**: Critical for deduplication - always normalize to +1 format
- **Contact vs Lead**: Frontend displays "contacts" but these are actually grouped leads - be mindful when implementing new features
- **Database Schema**: Follows contact-lead relationship model, not just individual leads
- **API Documentation**: Must be updated in both `API_DOCUMENTATION.md` AND `ApiDocumentation.tsx` component