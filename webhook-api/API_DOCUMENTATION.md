# Convio Leads Webhook API Documentation

## Overview

The Convio Leads Webhook API is a Cloudflare Workers-based service for receiving, processing, and managing lead data from multiple third-party providers. Built with Hono.js and TypeScript, it provides a robust, scalable solution for webhook ingestion and lead management.

**Base URL**: `https://api.homeprojectpartners.com`
**Version**: 1.0.0
**Technology Stack**: Cloudflare Workers, Hono.js, D1 Database, TypeScript

## Table of Contents

1. [Authentication & Security](#authentication--security)
2. [Rate Limiting](#rate-limiting)
3. [API Endpoints](#api-endpoints)
   - [Health Check](#health-check-endpoints)
   - [Webhook Management](#webhook-endpoints)
   - [Lead Management](#lead-endpoints)
4. [Data Schemas](#data-schemas)
5. [Error Handling](#error-handling)
6. [Webhook Configuration](#webhook-configuration)
7. [Testing](#testing)

## Authentication & Security

### Webhook Signatures
All webhook payloads can be optionally secured with HMAC-SHA256 signatures:

```http
X-Webhook-Signature: sha256=<signature>
```

The signature is calculated as:
```
signature = HMAC-SHA256(secret + payload)
```

### Security Headers
All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### CORS Configuration
Allowed origins:
- `https://homeprojectpartners.com`
- `https://api.homeprojectpartners.com`
- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost:8080`

## Rate Limiting

- **Limit**: 100 requests per minute per IP address
- **Window**: 60 seconds (rolling window)
- **Headers returned**:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: <remaining>`
  - `X-RateLimit-Reset: <timestamp>`

When rate limit is exceeded:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Maximum 100 requests per minute allowed.",
  "limit": 100,
  "window": "1 minute",
  "retry_after": 45,
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

## API Endpoints

### Root Endpoint

#### GET /
Returns basic API information.

**Response**:
```json
{
  "service": "Convio Leads Webhook API",
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

---

### Health Check Endpoints

#### GET /health
Basic health check.

**Response**:
```json
{
  "status": "healthy",
  "service": "Convio Leads Webhook API",
  "timestamp": "2024-09-24T21:00:00.000Z",
  "uptime": 0,
  "version": "1.0.0"
}
```

#### GET /health/detailed
Comprehensive health check with system status.

**Response**:
```json
{
  "status": "healthy",
  "service": "Convio Leads Webhook API",
  "timestamp": "2024-09-24T21:00:00.000Z",
  "uptime": 0,
  "version": "1.0.0",
  "checks": {
    "api": "healthy",
    "webhooks": "healthy"
  },
  "metrics": {
    "memory_usage": null,
    "environment": "production"
  }
}
```

#### GET /health/live
Kubernetes-style liveness probe.

**Response**:
```json
{
  "status": "alive"
}
```

#### GET /health/ready
Kubernetes-style readiness probe.

**Response**:
```json
{
  "status": "ready"
}
```

---

### Webhook Endpoints

#### GET /webhook
List all configured webhooks.

**Response**:
```json
{
  "service": "Webhook API",
  "total_webhooks": 3,
  "webhooks": [
    {
      "id": "ws_cal_solar_001",
      "name": "Solar Leads - California",
      "type": "solar",
      "region": "california",
      "category": "solar",
      "endpoints": {
        "health": "/webhook/ws_cal_solar_001",
        "receive": "/webhook/ws_cal_solar_001"
      }
    }
  ],
  "usage": {
    "health_check": "GET /webhook/{webhookId}",
    "receive_lead": "POST /webhook/{webhookId}",
    "list_all": "GET /webhook",
    "create_webhook": "POST /webhook",
    "delete_webhook": "DELETE /webhook/{webhookId}"
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /webhook/:webhookId
Health check for specific webhook endpoint.

**Parameters**:
- `webhookId` (string): Must follow pattern `ws_[region]_[category]_[id]`

**Response** (200):
```json
{
  "status": "healthy",
  "webhook_id": "ws_cal_solar_001",
  "config": {
    "name": "Solar Leads - California",
    "type": "solar",
    "region": "california",
    "category": "solar"
  },
  "endpoints": {
    "health": "GET /webhook/ws_cal_solar_001",
    "receive": "POST /webhook/ws_cal_solar_001"
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (400 - Invalid webhook ID):
```json
{
  "error": "Invalid webhook ID format",
  "message": "Webhook ID must follow pattern: ws_[region]_[category]_[id] (e.g., ws_cal_solar_001)",
  "expected_format": "ws_[2-3 letter region]_[category]_[3 digit id]",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (404 - Webhook not found):
```json
{
  "error": "Webhook not configured",
  "message": "Webhook ws_cal_solar_001 is not configured in the system",
  "available_webhooks": ["ws_cal_solar_001", "ws_tx_hvac_002", "ws_fl_ins_003"],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### POST /webhook/:webhookId
Receive and process lead data via webhook.

**Parameters**:
- `webhookId` (string): Webhook identifier

**Headers**:
- `Content-Type: application/json` (required)
- `X-Webhook-Signature: sha256=<signature>` (optional, required if WEBHOOK_SECRET is configured)

**Request Body**: Varies by lead type (see [Data Schemas](#data-schemas))

**Phone Number Normalization**:
Phone numbers are automatically normalized to E.164 format (+1XXXXXXXXXX) when stored in the database. The API accepts phone numbers in various formats:
- `"5551234567"` → `"+15551234567"`
- `"555-123-4567"` → `"+15551234567"`
- `"(555) 123-4567"` → `"+15551234567"`
- `"+15551234567"` → `"+15551234567"`

**Response** (201):
```json
{
  "status": "success",
  "message": "Lead received and processed successfully",
  "webhook_id": "ws_cal_solar_001",
  "contact_id": 12345,
  "lead_id": 12345,
  "email": "john.doe@example.com",
  "processed_at": "2024-09-24T21:00:00.000Z",
  "next_steps": [
    "Lead data validated and normalized",
    "Lead stored in database",
    "Lead processing pipeline triggered",
    "CRM notification sent"
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (400 - Invalid webhook ID):
```json
{
  "error": "Invalid webhook ID format",
  "message": "Webhook ID must follow pattern: ws_[region]_[category]_[id]",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (404 - Webhook not configured):
```json
{
  "error": "Webhook not configured",
  "message": "Webhook ws_cal_solar_001 is not configured",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (401 - Invalid signature):
```json
{
  "error": "Invalid signature",
  "message": "Webhook signature validation failed",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

**Response** (422 - Validation failed):
```json
{
  "error": "Validation failed",
  "message": "Lead data validation failed",
  "details": [
    {
      "field": "firstName",
      "message": "First name is required",
      "code": "invalid_type"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### POST /webhook
Create a new webhook configuration (Demo - requires deployment for actual creation).

**Request Body**:
```json
{
  "name": "Solar Leads - Nevada",
  "type": "solar",
  "region": "nv",
  "category": "solar"
}
```

**Response** (201):
```json
{
  "status": "success",
  "message": "Webhook configuration created (Note: This is a demo - actual webhook creation requires API deployment)",
  "webhook": {
    "id": "ws_nv_solar_123",
    "name": "Solar Leads - Nevada",
    "type": "solar",
    "region": "nv",
    "category": "solar",
    "endpoints": {
      "health": "/webhook/ws_nv_solar_123",
      "receive": "/webhook/ws_nv_solar_123"
    }
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### DELETE /webhook/:webhookId
Delete a webhook configuration (Demo - requires deployment for actual deletion).

**Response** (200):
```json
{
  "status": "success",
  "message": "Webhook configuration deleted (Note: This is a demo - actual webhook deletion requires API deployment)",
  "webhook_id": "ws_cal_solar_001",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### PATCH /webhook/:webhookId/status
Enable or disable a webhook configuration.

**Parameters**:
- `webhookId` (string): Webhook identifier

**Request Body**:
```json
{
  "enabled": true
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Webhook status updated successfully",
  "webhook_id": "ws_cal_solar_001",
  "enabled": true,
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

---

### Lead Endpoints

#### GET /leads
Get all leads with optional filtering.

**Query Parameters**:
- `webhook_id` (string): Filter by webhook ID
- `status` (string): Filter by lead status
- `from_date` (string): Filter from date (YYYY-MM-DD)
- `to_date` (string): Filter to date (YYYY-MM-DD)
- `limit` (number): Maximum results (default: 100)

**Response** (200):
```json
{
  "status": "success",
  "count": 3,
  "filters": {
    "webhook_id": "ws_cal_solar_001",
    "status": "new",
    "from_date": "2024-09-01",
    "to_date": "2024-09-30"
  },
  "leads": [
    {
      "id": 1,
      "webhook_id": "ws_cal_solar_001",
      "lead_type": "solar",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "555-123-4567",
      "status": "new",
      "created_at": "2024-09-24T21:00:00.000Z"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/statistics
Get lead statistics and metrics.

**Query Parameters**:
- `webhook_id` (string): Filter by webhook ID
- `status` (string): Filter by lead status
- `from_date` (string): Filter from date
- `to_date` (string): Filter to date

**Response** (200):
```json
{
  "status": "success",
  "filters": {
    "webhook_id": null,
    "status": null,
    "from_date": null,
    "to_date": null
  },
  "statistics": {
    "total_leads": 150,
    "unique_webhooks": 3,
    "days_active": 30,
    "first_lead_date": "2024-08-25T10:30:00.000Z",
    "last_lead_date": "2024-09-24T20:45:00.000Z",
    "conversion_rate": 15.25,
    "status_breakdown": {
      "new": 45,
      "contacted": 30,
      "qualified": 25,
      "converted": 20,
      "rejected": 30
    }
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/status/:status
Get leads by specific status.

**Parameters**:
- `status` (string): One of: new, contacted, qualified, converted, rejected

**Query Parameters**:
- `limit` (number): Maximum results (default: 100)

**Response** (200):
```json
{
  "status": "success",
  "lead_status": "new",
  "count": 45,
  "leads": [
    {
      "id": 1,
      "webhook_id": "ws_cal_solar_001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "status": "new",
      "created_at": "2024-09-24T21:00:00.000Z"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/analytics/:webhookId
Get analytics for a specific webhook.

**Parameters**:
- `webhookId` (string): Webhook identifier

**Query Parameters**:
- `days` (number): Number of days to analyze (default: 30)

**Response** (200):
```json
{
  "status": "success",
  "webhook_id": "ws_cal_solar_001",
  "period_days": 30,
  "analytics": {
    "total_leads": 50,
    "converted_leads": 8,
    "avg_conversion_score": 7.5,
    "total_revenue_potential": 150000,
    "first_lead_date": "2024-08-25T10:30:00.000Z",
    "last_lead_date": "2024-09-24T20:45:00.000Z"
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/:leadId
Get a single lead by ID.

**Parameters**:
- `leadId` (number): Lead identifier

**Response** (200):
```json
{
  "status": "success",
  "lead": {
    "id": 1,
    "webhook_id": "ws_cal_solar_001",
    "lead_type": "solar",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "address": "123 Main St",
    "city": "Los Angeles",
    "state": "CA",
    "zip_code": "90210",
    "source": "Google Ads",
    "status": "new",
    "monthly_electric_bill": 250.50,
    "property_type": "single-family",
    "roof_condition": "good",
    "raw_payload": "{...}",
    "created_at": "2024-09-24T21:00:00.000Z",
    "updated_at": "2024-09-24T21:00:00.000Z"
  },
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/search/phone/:phoneNumber
Search for contacts by phone number with automatic normalization.

**Parameters**:
- `phoneNumber` (string): Phone number in any format (555-123-4567, 5551234567, (555) 123-4567, +15551234567)

**Features**:
- Automatic phone number normalization to +1 format
- Supports various input formats (with/without dashes, parentheses, country code)
- Returns all contacts that match the normalized phone number

**Response** (200):
```json
{
  "status": "success",
  "search_phone": "555-987-6543",
  "normalized_phone": "+15559876543",
  "count": 1,
  "contacts": [
    {
      "id": 9,
      "webhook_id": "ws_us_general_187",
      "lead_type": "lead",
      "first_name": "Sarah",
      "last_name": "Johnson",
      "email": "sarah.johnson@test.com",
      "phone": "+15559876543",
      "address": null,
      "city": null,
      "state": null,
      "zip_code": null,
      "source": "Phone Normalization Test",
      "status": "new",
      "created_at": "2025-09-25 05:59:47",
      "updated_at": "2025-09-25 05:59:47",
      "processed_at": null,
      "revenue_potential": null,
      "conversion_score": null,
      "priority": 1,
      "assigned_to": null,
      "follow_up_date": null,
      "contact_attempts": 0
    }
  ],
  "timestamp": "2025-09-25T06:00:22.878Z"
}
```

**Error Responses**:

Invalid phone number (400):
```json
{
  "error": "Invalid phone number",
  "message": "Please provide a valid phone number format",
  "examples": ["5551234567", "555-123-4567", "(555) 123-4567", "+15551234567"],
  "timestamp": "2025-09-25T06:01:16.486Z"
}
```

**Example Usage**:
```bash
# Search with different formats - all find the same contact
curl "https://api.homeprojectpartners.com/leads/search/phone/555-987-6543"
curl "https://api.homeprojectpartners.com/leads/search/phone/5559876543"
curl "https://api.homeprojectpartners.com/leads/search/phone/(555) 987-6543"
curl "https://api.homeprojectpartners.com/leads/search/phone/+15559876543"
```

#### PATCH /leads/:leadId/status
Update lead status (backwards compatibility).

**Parameters**:
- `leadId` (number): Lead identifier

**Request Body**:
```json
{
  "status": "contacted",
  "notes": "Called customer, left voicemail"
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Lead status updated successfully",
  "lead_id": 1,
  "old_status": "new",
  "new_status": "contacted",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### PUT /leads/:leadId/status
Comprehensive lead status update.

**Parameters**:
- `leadId` (number): Lead identifier

**Request Body**:
```json
{
  "status": "qualified",
  "notes": "Customer interested in solar installation",
  "reason": "High energy bills",
  "changedBy": "user123",
  "changedByName": "Sarah Johnson",
  "followUpDate": "2024-09-25T10:00:00.000Z",
  "assignedTo": "sales-rep-456",
  "priority": 3
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Lead status updated successfully",
  "lead_id": 1,
  "old_status": "contacted",
  "new_status": "qualified",
  "changed_by": "Sarah Johnson",
  "reason": "High energy bills",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/:leadId/history
Get lead status change history.

**Parameters**:
- `leadId` (number): Lead identifier

**Response** (200):
```json
{
  "status": "success",
  "lead_id": 1,
  "history_count": 3,
  "history": [
    {
      "id": 1,
      "lead_id": 1,
      "old_status": "contacted",
      "new_status": "qualified",
      "changed_by": "user123",
      "changed_by_name": "Sarah Johnson",
      "reason": "High energy bills",
      "notes": "Customer very interested",
      "created_at": "2024-09-24T15:30:00.000Z"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/:leadId/activities
Get lead activities and timeline.

**Parameters**:
- `leadId` (number): Lead identifier

**Query Parameters**:
- `limit` (number): Maximum activities (default: 50)

**Response** (200):
```json
{
  "status": "success",
  "lead_id": 1,
  "activities_count": 5,
  "activities": [
    {
      "id": 1,
      "lead_id": 1,
      "activity_type": "status_change",
      "title": "Status changed from new to contacted",
      "description": "Initial contact attempt",
      "created_by": "user123",
      "created_by_name": "John Smith",
      "activity_date": "2024-09-24T14:00:00.000Z",
      "created_at": "2024-09-24T14:00:00.000Z"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### POST /leads/:leadId/activities
Add an activity to a lead.

**Parameters**:
- `leadId` (number): Lead identifier

**Request Body**:
```json
{
  "activityType": "call",
  "title": "Follow-up call",
  "description": "Discussed solar panel options and financing",
  "createdBy": "user123",
  "createdByName": "Sarah Johnson",
  "activityDate": "2024-09-24T16:00:00.000Z"
}
```

**Response** (200):
```json
{
  "status": "success",
  "message": "Activity added successfully",
  "lead_id": 1,
  "activity_type": "call",
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### GET /leads/pipeline/stages
Get pipeline stages configuration.

**Response** (200):
```json
{
  "status": "success",
  "stages_count": 7,
  "stages": [
    {
      "id": 1,
      "stage_name": "new",
      "display_name": "New Lead",
      "order_index": 1,
      "is_active": 1,
      "color": "#3B82F6"
    },
    {
      "id": 2,
      "stage_name": "contacted",
      "display_name": "Contacted",
      "order_index": 2,
      "is_active": 1,
      "color": "#F59E0B"
    }
  ],
  "timestamp": "2024-09-24T21:00:00.000Z"
}
```

#### DELETE /leads/:leadId
Delete a single lead by ID.

**Parameters**:
- `leadId` (number): Lead identifier

**Features**:
- Automatically handles foreign key constraints by deleting related records first
- Deletes associated `lead_events` before removing the lead
- Permanent deletion from database

**Response** (200):
```json
{
  "status": "success",
  "message": "Lead deleted successfully",
  "deleted_lead": {
    "id": 12,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+15551234567",
    "webhook_id": "ws_cal_solar_001"
  },
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

**Error Responses**:

Lead not found (404):
```json
{
  "error": "Lead not found",
  "message": "No lead found with ID 12",
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

Invalid lead ID (400):
```json
{
  "error": "Invalid lead ID",
  "message": "Lead ID must be a valid number",
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

#### DELETE /leads/contact/:contactId
Delete a contact and all associated leads.

**Parameters**:
- `contactId` (number): Contact identifier

**Features**:
- Cascade deletion - removes contact and ALL associated leads
- Handles foreign key constraints by deleting in correct order:
  1. `lead_events` for all leads with this contact_id
  2. `contact_events` for the contact
  3. All `leads` with this contact_id
  4. The `contact` record
- Returns count of leads deleted along with contact
- Permanent deletion from database

**Response** (200):
```json
{
  "status": "success",
  "message": "Contact and associated leads deleted successfully",
  "deleted_contact": {
    "id": 1,
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "phone": "+15559998888",
    "webhook_id": "click-ventures_ws_us_general_656",
    "leads_deleted": 2
  },
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

**Error Responses**:

Contact not found (404):
```json
{
  "error": "Contact not found",
  "message": "No contact found with ID 1",
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

Invalid contact ID (400):
```json
{
  "error": "Invalid contact ID",
  "message": "Contact ID must be a valid number",
  "timestamp": "2025-09-25T11:45:00.000Z"
}
```

**Example Usage**:
```bash
# Delete individual lead
curl -X DELETE "https://api.homeprojectpartners.com/leads/12"

# Delete contact and all associated leads
curl -X DELETE "https://api.homeprojectpartners.com/leads/contact/1"
```

---

## Data Schemas

### Base Lead Schema
All lead types include these base fields:

```typescript
{
  firstName: string;      // Required
  lastName: string;       // Required
  email?: string;         // Optional, but validated if provided
  phone?: string;         // Optional, minimum 10 digits if provided
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  source: string;         // Required
  campaign?: string;
  notes?: string;
  timestamp?: string;     // ISO 8601 datetime
}
```

### Solar Lead Schema
Extends base schema with:

```typescript
{
  propertyType?: 'single-family' | 'townhouse' | 'condo' | 'apartment' | 'commercial';
  monthlyElectricBill?: number;     // Positive number
  roofCondition?: 'excellent' | 'good' | 'fair' | 'poor';
  roofAge?: number;                 // 0-100 years
  shadeIssues?: boolean;
  homeownershipStatus?: 'own' | 'rent' | 'other';
  creditScore?: 'excellent' | 'good' | 'fair' | 'poor';
  annualIncome?: 'under-50k' | '50k-75k' | '75k-100k' | '100k-150k' | 'over-150k';
}
```

### HVAC Lead Schema
Extends base schema with:

```typescript
{
  serviceType?: 'installation' | 'repair' | 'maintenance' | 'consultation';
  systemAge?: number;               // 0-50 years
  systemType?: 'central-air' | 'heat-pump' | 'ductless' | 'window-unit' | 'other';
  homeSize?: 'under-1000' | '1000-2000' | '2000-3000' | '3000-4000' | 'over-4000';
  urgency?: 'immediate' | 'within-week' | 'within-month' | 'planning';
  budget?: 'under-5k' | '5k-10k' | '10k-15k' | '15k-20k' | 'over-20k';
  preferredContactTime?: 'morning' | 'afternoon' | 'evening' | 'weekend';
}
```

### Insurance Lead Schema
Extends base schema with:

```typescript
{
  insuranceType?: 'auto' | 'home' | 'life' | 'health' | 'business' | 'other';
  currentProvider?: string;
  currentPremium?: number;          // Positive number
  coverageAmount?: number;          // Positive number
  renewalDate?: string;             // ISO 8601 datetime
  claimsHistory?: boolean;
  vehicleInfo?: {
    year: number;                   // 1900-2025
    make: string;
    model: string;
    mileage?: number;               // Non-negative
  };
  propertyInfo?: {
    propertyValue: number;          // Positive number
    homeAge: number;                // 0-200 years
    securitySystem: boolean;
  };
}
```

### Lead Status Values
Valid status values for leads:
- `new` - Newly received lead
- `contacted` - Initial contact made
- `qualified` - Lead meets qualification criteria
- `proposal_sent` - Proposal or quote sent
- `negotiating` - In negotiation phase
- `scheduled` - Appointment or service scheduled
- `converted` - Successfully converted to customer
- `rejected` - Lead rejected by customer
- `lost` - Lost to competitor or other reasons

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-09-24T21:00:00.000Z",
  "details": "Additional context (when applicable)"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `rate_limit_exceeded` | 429 | Too many requests from IP |
| `invalid_webhook_id` | 400 | Webhook ID format invalid |
| `webhook_not_configured` | 404 | Webhook not found |
| `invalid_signature` | 401 | Webhook signature invalid |
| `validation_error` | 422 | Request data validation failed |
| `invalid_json` | 400 | Request body not valid JSON |
| `invalid_content_type` | 400 | Content-Type not application/json |
| `payload_too_large` | 413 | Request body exceeds 1MB |
| `database_error` | 500 | Database operation failed |
| `timeout_error` | 504 | Request timeout |
| `internal_server_error` | 500 | Unexpected server error |

## Webhook Configuration

### Current Configured Webhooks

| Webhook ID | Name | Type | Region | Category |
|------------|------|------|--------|----------|
| `ws_cal_solar_001` | Solar Leads - California | solar | california | solar |
| `ws_tx_hvac_002` | HVAC Leads - Texas | hvac | texas | hvac |
| `ws_fl_ins_003` | Insurance - Florida | insurance | florida | insurance |

### Webhook ID Pattern
Format: `ws_[region]_[category]_[id]`
- `region`: 2-3 letter region code (e.g., 'cal', 'tx', 'fl')
- `category`: Lead category (e.g., 'solar', 'hvac', 'ins')
- `id`: 3-digit identifier (e.g., '001', '002', '003')

Examples:
- `ws_cal_solar_001` - California Solar leads
- `ws_tx_hvac_002` - Texas HVAC leads
- `ws_ny_ins_004` - New York Insurance leads

## Database Schema

The API uses Cloudflare D1 (SQLite) with the following key tables:

### `leads` Table
Stores all lead data with columns for each lead type's specific fields.

### `lead_events` Table
Tracks all events and changes for audit purposes.

### `webhook_configs` Table
Manages webhook configurations and rate limiting.

### `lead_status_history` Table
Maintains complete history of status changes.

### `lead_activities` Table
Records all activities and interactions with leads.

### `lead_analytics` Table
Aggregated daily analytics data for reporting.

## Testing

### Test Script
A comprehensive test script is provided at `/webhook-api/test-webhook-api.sh`.

### Sample Test Commands

```bash
# Test health endpoint
curl -X GET https://api.homeprojectpartners.com/health

# Test webhook endpoint
curl -X POST https://api.homeprojectpartners.com/webhook/ws_cal_solar_001 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "source": "Google Ads",
    "monthlyElectricBill": 250,
    "propertyType": "single-family"
  }'

# Get leads
curl -X GET "https://api.homeprojectpartners.com/leads?limit=10"

# Update lead status
curl -X PUT https://api.homeprojectpartners.com/leads/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "contacted",
    "notes": "Initial contact made",
    "changedBy": "user123"
  }'

# Delete individual lead
curl -X DELETE "https://api.homeprojectpartners.com/leads/1"

# Delete contact and all associated leads
curl -X DELETE "https://api.homeprojectpartners.com/leads/contact/1"
```

### Environment Variables
Required for full functionality:
- `LEADS_DB`: D1 Database binding
- `WEBHOOK_SECRET`: Optional webhook signature validation secret

## Support

For API support, integration questions, or bug reports, please contact the development team or create an issue in the project repository.

---

*Generated on 2024-09-24*
*API Version: 1.0.0*