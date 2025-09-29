import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ExternalLink, FileText, Code2, Globe, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ApiDocumentationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ApiDocumentation = ({ open, onOpenChange }: ApiDocumentationProps) => {
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Code example copied successfully.",
    });
  };

  const endpoints = [
    {
      id: 'health',
      method: 'GET',
      path: '/health',
      title: 'Health Check',
      description: 'Basic health check endpoint',
      example: `curl -X GET https://api.homeprojectpartners.com/health`,
      response: `{
  "status": "healthy",
  "service": "Convio Leads Webhook API",
  "timestamp": "2024-09-24T21:00:00.000Z",
  "version": "1.0.0"
}`
    },
    {
      id: 'webhook-list',
      method: 'GET',
      path: '/webhook',
      title: 'List Webhooks',
      description: 'Get all configured webhook endpoints',
      example: `curl -X GET https://api.homeprojectpartners.com/webhook`,
      response: `{
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
  ]
}`
    },
    {
      id: 'webhook-receive',
      method: 'POST',
      path: '/webhook/:webhookId',
      title: 'Receive Lead Data',
      description: 'Submit lead data via webhook (requires provider authentication)',
      example: `curl -X POST https://api.homeprojectpartners.com/webhook/click-ventures_ws_us_general_656 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: click_ventures_001" \\
  -H "X-Webhook-Signature: sha256=abc123..." \\
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "address1": "123 Main Street",
    "address2": "Apt 4B",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90210",
    "source": "Google Ads",
    "productid": "Solar",
    "subsource": "Solar Installation Campaign",
    "landing_page_url": "https://solarpanel.com/ca-landing",
    "consent": {
      "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
      "value": true
    },
    "tcpa_compliance": true
  }'`,
      response: `{
  "status": "success",
  "message": "Lead received and processed successfully",
  "webhook_id": "click-ventures_ws_us_general_656",
  "contact_id": 12345,
  "email": "john.doe@example.com",
  "processed_at": "2024-09-24T21:00:00.000Z",
  "next_steps": [
    "Lead data validated and normalized",
    "Lead stored in database",
    "Lead processing pipeline triggered"
  ]
}`,
      errorResponses: [
        {
          code: 401,
          title: "Missing Provider Authentication",
          description: "When Authorization header is missing",
          response: `{
  "error": "Missing provider authentication",
  "message": "Authorization header is required",
  "timestamp": "2025-09-26T09:56:27.948Z"
}`
        },
        {
          code: 401,
          title: "Invalid Provider",
          description: "When provider ID is not authorized or inactive",
          response: `{
  "error": "Invalid provider",
  "message": "Provider invalid_provider_999 is not authorized or is inactive",
  "timestamp": "2025-09-26T09:56:33.857Z"
}`
        }
      ]
    },
    {
      id: 'leads-list',
      method: 'GET',
      path: '/leads',
      title: 'Get Leads',
      description: 'Retrieve leads with optional filtering',
      example: `curl -X GET "https://api.homeprojectpartners.com/leads?limit=10&status=new"`,
      response: `{
  "status": "success",
  "count": 3,
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
  ]
}`
    },
    {
      id: 'lead-status-update',
      method: 'PUT',
      path: '/leads/:leadId/status',
      title: 'Update Lead Status',
      description: 'Update lead status with comprehensive tracking',
      example: `curl -X PUT https://api.homeprojectpartners.com/leads/1/status \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "contacted",
    "notes": "Initial contact made",
    "changedBy": "user123",
    "changedByName": "Sarah Johnson"
  }'`,
      response: `{
  "status": "success",
  "message": "Lead status updated successfully",
  "lead_id": 1,
  "old_status": "new",
  "new_status": "contacted"
}`
    },
    {
      id: 'phone-search',
      method: 'GET',
      path: '/leads/search/phone/:phoneNumber',
      title: 'Search by Phone (DEPRECATED)',
      description: '⚠️ DEPRECATED - Use /contacts/search/phone/:phoneNumber instead. Search for contacts by phone number with automatic normalization',
      example: `curl -X GET "https://api.homeprojectpartners.com/leads/search/phone/555-987-6543"`,
      response: `{
  "status": "success",
  "search_phone": "555-987-6543",
  "normalized_phone": "+15559876543",
  "count": 1,
  "contacts": [
    {
      "id": 9,
      "webhook_id": "ws_us_general_187",
      "first_name": "Sarah",
      "last_name": "Johnson",
      "email": "sarah.johnson@test.com",
      "phone": "+15559876543",
      "source": "Phone Normalization Test",
      "status": "new",
      "created_at": "2025-09-25 05:59:47"
    }
  ]
}`
    },
    {
      id: 'contact-search-phone',
      method: 'GET',
      path: '/contacts/search/phone/:phoneNumber',
      title: 'Enhanced Contact Search',
      description: 'Search contacts by phone with full relationship data including leads, appointments, and conversions. Use ?include= query parameter to control data returned',
      example: `# Basic search (contact + leads)
curl -X GET "https://api.homeprojectpartners.com/contacts/search/phone/+15559990000"

# Include all data
curl -X GET "https://api.homeprojectpartners.com/contacts/search/phone/+15559990000?include=all"

# Include specific data types
curl -X GET "https://api.homeprojectpartners.com/contacts/search/phone/+15559990000?include=leads,appointments,conversions"`,
      response: `{
  "status": "success",
  "search_phone": "+15559990000",
  "normalized_phone": "+15559990000",
  "includes": ["all"],
  "contact": {
    "id": 650963,
    "phone": "+15559990000",
    "first_name": "NewUser",
    "last_name": "Complete",
    "email": "newuser.complete@example.com",
    "lifetime_value": 280000,
    "conversion_count": 8,
    "leads": [
      {
        "id": 1234567890,
        "lead_type": "solar",
        "status": "converted",
        "revenue_potential": 5000,
        "workspace_id": "demo_sales_team",
        "workspace_name": "Demo Sales Team"
      }
    ],
    "appointments": [
      {
        "id": 456,
        "service_type": "solar",
        "scheduled_at": "2025-09-30T10:00:00Z",
        "matched_workspace_id": "demo_sales_team",
        "workspace_name": "Demo Sales Team"
      }
    ],
    "conversions": [
      {
        "id": "985d0ad2-72a9-4c7b",
        "conversion_type": "appointment",
        "conversion_value": 5000,
        "workspace_name": "Demo Sales Team"
      }
    ],
    "summary": {
      "total_leads": 1,
      "total_appointments": 1,
      "total_conversions": 1,
      "lifetime_value": 280000,
      "primary_workspace": "demo_sales_team"
    }
  }
}`
    },
    {
      id: 'delete-lead',
      method: 'DELETE',
      path: '/leads/:leadId',
      title: 'Delete Lead',
      description: 'Delete a single lead by ID with automatic foreign key handling',
      example: `curl -X DELETE "https://api.homeprojectpartners.com/leads/12"`,
      response: `{
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
}`
    },
    {
      id: 'contacts-list',
      method: 'GET',
      path: '/contacts',
      title: 'List All Contacts',
      description: 'Get all contacts with optional filtering and includes. Use ?include= parameter to include associated data (leads, appointments, conversions)',
      example: `# Basic contacts (without leads)
curl -X GET "https://api.homeprojectpartners.com/contacts?limit=100"

# Include leads for each contact
curl -X GET "https://api.homeprojectpartners.com/contacts?include=leads&limit=100"

# Filter by webhook
curl -X GET "https://api.homeprojectpartners.com/contacts?webhook_id=ws_cal_solar_001&include=leads"`,
      response: `{
  "status": "success",
  "count": 24,
  "filters": {
    "webhook_id": null,
    "limit": 100,
    "includes": ["leads"]
  },
  "contacts": [
    {
      "id": 650963,
      "webhook_id": "click-ventures_ws_us_general_656",
      "phone": "+15559990000",
      "first_name": "NewUser",
      "last_name": "Complete",
      "email": "newuser.complete@example.com",
      "address": "123 Main Street",
      "city": "Los Angeles",
      "state": "CA",
      "zip_code": "90210",
      "created_at": "2025-09-25T05:59:47.000Z",
      "updated_at": "2025-09-25T11:45:00.000Z",
      "lifetime_value": 280000,
      "conversion_count": 8,
      "leads": [
        {
          "id": 1234567890,
          "contact_id": 650963,
          "lead_type": "solar",
          "status": "converted",
          "revenue_potential": 5000,
          "workspace_id": "demo_sales_team",
          "workspace_name": "Demo Sales Team",
          "created_at": "2025-09-25T05:59:47.000Z"
        }
      ]
    }
  ],
  "timestamp": "2025-09-25T11:45:00.000Z"
}`
    },
    {
      id: 'contact-leads',
      method: 'GET',
      path: '/contacts/:contactId/leads',
      title: 'Get Contact Leads',
      description: 'Get all leads for a specific contact',
      example: `curl -X GET "https://api.homeprojectpartners.com/contacts/650963/leads?limit=50"`,
      response: `{
  "status": "success",
  "contact_id": 650963,
  "count": 1,
  "leads": [
    {
      "id": 1234567890,
      "contact_id": 650963,
      "webhook_id": "click-ventures_ws_us_general_656",
      "lead_type": "solar",
      "first_name": "NewUser",
      "last_name": "Complete",
      "email": "newuser.complete@example.com",
      "phone": "+15559990000",
      "source": "Google Ads",
      "status": "converted",
      "revenue_potential": 5000,
      "workspace_id": "demo_sales_team",
      "workspace_name": "Demo Sales Team",
      "created_at": "2025-09-25T05:59:47.000Z",
      "updated_at": "2025-09-25T11:45:00.000Z"
    }
  ],
  "timestamp": "2025-09-25T11:45:00.000Z"
}`
    },
    {
      id: 'delete-contact',
      method: 'DELETE',
      path: '/contacts/:contactId',
      title: 'Delete Contact',
      description: 'Delete a contact and ALL associated leads with cascade deletion',
      example: `curl -X DELETE "https://api.homeprojectpartners.com/contacts/1"`,
      response: `{
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
}`
    },
    {
      id: 'workspace-register',
      method: 'POST',
      path: '/conversions/workspace/register',
      title: 'Register Workspace',
      description: 'Register a new workspace for conversion tracking',
      example: `curl -X POST https://api.homeprojectpartners.com/conversions/workspace/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "demo_sales_team",
    "name": "Demo Sales Team",
    "permissions": ["read", "write", "convert"]
  }'`,
      response: `{
  "success": true,
  "workspace": {
    "id": "demo_sales_team",
    "name": "Demo Sales Team",
    "api_key": "ws_x82lzd6tt9ebb8pezd337",
    "permissions": ["read", "write", "convert"]
  }
}`
    },
    {
      id: 'conversion-log',
      method: 'POST',
      path: '/conversions/log',
      title: 'Log Conversion',
      description: 'Log a new conversion event with custom metadata',
      example: `curl -X POST https://api.homeprojectpartners.com/conversions/log \\
  -H "Content-Type: application/json" \\
  -H "X-Workspace-ID: demo_sales_team" \\
  -H "X-API-Key: your_workspace_api_key" \\
  -d '{
    "contact_id": 650963,
    "lead_id": 1234567890,
    "workspace_id": "demo_sales_team",
    "converted_by": "john_sales_agent",
    "conversion_type": "sale",
    "conversion_value": 45000,
    "custom_data": {
      "product": "Premium Solar System",
      "contract_id": "SOL-2025-001",
      "financing_type": "loan",
      "system_size_kw": 12.5
    }
  }'`,
      response: `{
  "success": true,
  "conversion": {
    "id": "33d60a6b-b83a-471d-aa84-a9824f873e38",
    "contact_id": 650963,
    "lead_id": 1234567890,
    "workspace_id": "demo_sales_team",
    "conversion_type": "sale",
    "conversion_value": 45000,
    "converted_at": "2025-09-25T18:01:11.063Z"
  }
}`
    },
    {
      id: 'conversion-contact-update',
      method: 'PATCH',
      path: '/conversions/contacts/:id',
      title: 'Update Contact Conversion',
      description: 'Update contact conversion status and metadata',
      example: `curl -X PATCH https://api.homeprojectpartners.com/conversions/contacts/650963 \\
  -H "Content-Type: application/json" \\
  -H "X-Workspace-ID: demo_sales_team" \\
  -H "X-API-Key: your_workspace_api_key" \\
  -d '{
    "conversion_status": "converted",
    "converted_by": "john_sales_agent",
    "qualification_score": 95,
    "custom_metadata": {
      "interested_products": ["solar", "battery"],
      "decision_timeline": "30_days"
    }
  }'`,
      response: `{
  "success": true,
  "contact_id": "650963",
  "updates_applied": true
}`
    },
    {
      id: 'conversions-list',
      method: 'GET',
      path: '/conversions',
      title: 'Query Conversions',
      description: 'Query conversions with advanced filters and pagination',
      example: `curl -X GET "https://api.homeprojectpartners.com/conversions?conversion_type=sale&min_value=10000&limit=10"`,
      response: `{
  "success": true,
  "conversions": [
    {
      "id": "33d60a6b-b83a-471d-aa84-a9824f873e38",
      "contact_id": 650963,
      "lead_id": 1234567890,
      "workspace_id": "demo_sales_team",
      "converted_by": "john_sales_agent",
      "converted_at": "2025-09-25T18:01:11.063Z",
      "conversion_type": "sale",
      "conversion_value": 45000,
      "currency": "USD",
      "first_name": "John",
      "last_name": "Doe",
      "workspace_name": "Demo Sales Team",
      "custom_data": {
        "product": "Premium Solar System",
        "contract_id": "SOL-2025-001"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}`
    },
    {
      id: 'conversions-analytics',
      method: 'GET',
      path: '/conversions/analytics',
      title: 'Conversion Analytics',
      description: 'Get comprehensive conversion analytics and metrics',
      example: `curl -X GET "https://api.homeprojectpartners.com/conversions/analytics?from_date=2025-01-01&workspace_id=demo_sales_team"`,
      response: `{
  "success": true,
  "analytics": {
    "summary": {
      "total_conversions": 3,
      "total_value": 53500,
      "average_value": 17833.33,
      "unique_contacts": 3,
      "active_workspaces": 2,
      "conversion_rate": "15.2"
    },
    "by_type": [
      {
        "conversion_type": "sale",
        "count": 1,
        "total_value": 45000,
        "avg_value": 45000
      }
    ],
    "by_workspace": [
      {
        "workspace_id": "demo_sales_team",
        "workspace_name": "Demo Sales Team",
        "conversions": 2,
        "total_value": 45000,
        "unique_contacts": 2
      }
    ]
  }
}`
    },
    {
      id: 'conversions-funnel',
      method: 'GET',
      path: '/conversions/funnel',
      title: 'Conversion Funnel',
      description: 'Get conversion funnel visualization data',
      example: `curl -X GET "https://api.homeprojectpartners.com/conversions/funnel?workspace_id=demo_sales_team"`,
      response: `{
  "success": true,
  "funnel": {
    "stages": [
      {
        "name": "Leads Received",
        "count": 100,
        "percentage": 100
      },
      {
        "name": "Contacted",
        "count": 75,
        "percentage": 75
      },
      {
        "name": "Qualified",
        "count": 30,
        "percentage": 30
      },
      {
        "name": "Converted",
        "count": 15,
        "percentage": 15
      }
    ],
    "conversion_rate": 15.0
  }
}`
    },
    {
      id: 'appointment-receive',
      method: 'POST',
      path: '/appointments/receive',
      title: 'Receive Appointment',
      description: 'Receive appointments from third-party providers with automatic routing. Use lead_id to link to existing leads and prevent duplicate contacts.',
      example: `curl -X POST https://api.homeprojectpartners.com/appointments/receive \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": 7725656196,
    "customer_name": "John Doe",
    "customer_phone": "555-123-4567",
    "customer_email": "john@example.com",
    "service_type": "Solar",
    "customer_zip": "90210",
    "appointment_date": "2025-10-01T14:00:00Z",
    "appointment_duration": 60,
    "appointment_type": "consultation",
    "estimated_value": 25000,
    "appointment_notes": "Customer interested in rooftop solar installation",
    "workspace_id": "optional_priority_workspace"
  }'`,
      response: `{
  "success": true,
  "message": "Appointment received and routed successfully",
  "appointment_id": 15,
  "contact_id": 868042,
  "lead_id": 7725656196,
  "matched_workspace_id": "chau_main_workspace",
  "routing_method": "auto",
  "appointment_date": "2025-10-01T14:00:00Z",
  "timestamp": "2025-09-29T00:29:05.637Z"
}`
    },
    {
      id: 'appointments-list',
      method: 'GET',
      path: '/appointments',
      title: 'List Appointments',
      description: 'Retrieve appointments with filtering and pagination',
      example: `curl -X GET "https://api.homeprojectpartners.com/appointments?workspace_id=default_workspace&limit=10"`,
      response: `{
  "success": true,
  "appointments": [
    {
      "id": 123,
      "lead_id": 789,
      "contact_id": 456,
      "appointment_type": "consultation",
      "scheduled_at": "2024-10-01T14:00:00Z",
      "duration_minutes": 60,
      "status": "scheduled",
      "customer_name": "John Doe",
      "customer_phone": "555-123-4567",
      "service_type": "Solar",
      "customer_zip": "90210",
      "estimated_value": 25000,
      "matched_workspace_id": "default_workspace",
      "workspace_name": "Default Workspace"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}`
    },
    {
      id: 'routing-rule-create',
      method: 'POST',
      path: '/routing-rules',
      title: 'Create Routing Rule',
      description: 'Create routing rules for automatic appointment assignment',
      example: `curl -X POST https://api.homeprojectpartners.com/routing-rules \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "default_workspace",
    "product_types": ["Solar", "Kitchen"],
    "zip_codes": ["90210", "90211", "90212"],
    "priority": 1,
    "is_active": true,
    "notes": "Beverly Hills area routing rule"
  }'`,
      response: `{
  "success": true,
  "message": "Routing rule created successfully",
  "rule": {
    "id": 1,
    "workspace_id": "default_workspace",
    "workspace_name": "Default Workspace",
    "product_types": ["Solar", "Kitchen"],
    "zip_codes": ["90210", "90211", "90212"],
    "priority": 1,
    "is_active": true,
    "notes": "Beverly Hills area routing rule",
    "zip_count": 3,
    "product_count": 2
  }
}`
    },
    {
      id: 'routing-rule-bulk',
      method: 'POST',
      path: '/routing-rules/bulk',
      title: 'Bulk Create Routing Rules',
      description: 'Create routing rules with CSV zip code support for bulk uploads',
      example: `curl -X POST https://api.homeprojectpartners.com/routing-rules/bulk \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "demo_sales_team",
    "product_types": ["Bath", "HVAC"],
    "zip_codes_csv": "10001,10002,10003,10004,10005",
    "priority": 2,
    "is_active": true,
    "notes": "NYC area bulk routing rule"
  }'`,
      response: `{
  "success": true,
  "message": "Bulk routing rule created successfully",
  "rule": {
    "id": 2,
    "workspace_id": "demo_sales_team",
    "workspace_name": "Demo Sales Team",
    "product_types": ["Bath", "HVAC"],
    "zip_count": 5,
    "product_count": 2,
    "priority": 2,
    "is_active": true,
    "notes": "NYC area bulk routing rule",
    "sample_zips": ["10001", "10002", "10003", "10004", "10005"]
  }
}`
    },
    {
      id: 'routing-rules-list',
      method: 'GET',
      path: '/routing-rules/:workspace_id',
      title: 'Get Routing Rules',
      description: 'Retrieve routing rules for a specific workspace',
      example: `curl -X GET "https://api.homeprojectpartners.com/routing-rules/default_workspace"`,
      response: `{
  "success": true,
  "workspace_id": "default_workspace",
  "rules": [
    {
      "id": 1,
      "workspace_id": "default_workspace",
      "product_types": ["Solar", "Kitchen"],
      "zip_codes": ["90210", "90211", "90212"],
      "priority": 1,
      "is_active": true,
      "workspace_name": "Default Workspace",
      "zip_count": 3,
      "product_count": 2
    }
  ],
  "total_rules": 1,
  "active_rules": 1
}`
    },
    {
      id: 'routing-rule-update',
      method: 'PUT',
      path: '/routing-rules/:id',
      title: 'Update Routing Rule',
      description: 'Update an existing routing rule with partial data (workspace_id cannot be changed)',
      example: `curl -X PUT https://api.homeprojectpartners.com/routing-rules/12 \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_types": ["Solar", "Battery Storage", "HVAC"],
    "zip_codes": ["90210", "90211", "90212", "90213"],
    "priority": 2,
    "is_active": false,
    "notes": "Updated coverage area"
  }'`,
      response: `{
  "success": true,
  "message": "Routing rule updated successfully",
  "rule": {
    "id": 12,
    "workspace_id": "chau_main_workspace",
    "workspace_name": "CHAU Main Workspace",
    "product_types": ["Solar", "Battery Storage", "HVAC"],
    "zip_codes": ["90210", "90211", "90212", "90213"],
    "priority": 2,
    "is_active": false,
    "notes": "Updated coverage area"
  }
}`
    },
    {
      id: 'routing-rule-delete',
      method: 'DELETE',
      path: '/routing-rules/:id',
      title: 'Delete Routing Rule',
      description: 'Delete a routing rule by ID',
      example: `curl -X DELETE https://api.homeprojectpartners.com/routing-rules/12`,
      response: `{
  "success": true,
  "message": "Routing rule deleted successfully",
  "deleted_rule_id": 12,
  "workspace_id": "chau_main_workspace"
}`
    },
    {
      id: 'appointment-forward',
      method: 'POST',
      path: '/appointments/:id/forward',
      title: 'Forward Appointment',
      description: 'Manually forward an appointment to a specific workspace',
      example: `curl -X POST https://api.homeprojectpartners.com/appointments/15/forward \\
  -H "Content-Type: application/json" \\
  -d '{
    "workspace_id": "target_workspace_id"
  }'`,
      response: `{
  "success": true,
  "message": "Appointment forwarded successfully",
  "appointment_id": 15,
  "workspace_id": "target_workspace_id",
  "forward_result": {
    "success": true,
    "response": "Appointment received successfully"
  }
}`
    },
    {
      id: 'provider-analytics',
      method: 'GET',
      path: '/providers/:providerId/conversions',
      title: 'Provider Conversion Analytics',
      description: 'Get conversion analytics for a specific provider, showing leads converted to appointments with ROI metrics',
      example: `curl -X GET "https://api.homeprojectpartners.com/providers/benjie_malinao_9378/conversions?from=09-01-2025&to=09-30-2025&status=scheduled"`,
      response: `{
  "status": "success",
  "provider": {
    "provider_id": "benjie_malinao_9378",
    "provider_name": "Benjie Malinao"
  },
  "date_range": {
    "from": "09-01-2025",
    "to": "09-30-2025",
    "from_sql": "2025-09-01",
    "to_sql": "2025-09-30 23:59:59"
  },
  "summary": {
    "total_leads": 15,
    "scheduled_appointments": 8,
    "conversion_rate": "53.33%",
    "total_estimated_value": 185000,
    "status_breakdown": {
      "scheduled": 8,
      "new": 4,
      "qualified": 2,
      "lost": 1
    }
  },
  "conversions": [
    {
      "lead_id": 1944718690,
      "contact_id": 982067,
      "customer_name": "Analytics Test",
      "email": "analytics.test@example.com",
      "phone": "+15551234998",
      "zip_code": "90210",
      "service_type": "Solar",
      "lead_status": "scheduled",
      "lead_source": "Google Ads",
      "lead_created_at": "2025-09-15T10:30:00Z",
      "appointment": {
        "appointment_id": 20,
        "appointment_date": "2025-10-20T15:00:00Z",
        "appointment_type": "consultation",
        "estimated_value": 45000,
        "forward_status": "success",
        "appointment_created_at": "2025-09-29T05:48:32Z"
      }
    }
  ],
  "timestamp": "2025-09-29T06:54:15.838Z"
}`
    }
  ];

  const schemas = [
    {
      name: 'Business Lead Schema (Primary)',
      description: 'Our primary, recommended schema for lead submission with business-focused fields and TCPA compliance',
      fields: [
        // Required Core Fields
        { name: 'firstName', type: 'string', required: true, description: 'First name of the lead' },
        { name: 'lastName', type: 'string', required: true, description: 'Last name of the lead' },
        { name: 'email', type: 'string', required: true, description: 'Email address of the lead' },
        { name: 'source', type: 'string', required: true, description: 'Lead source (e.g., "Google Ads", "Facebook", "Referral")' },

        // Contact Information
        { name: 'phone', type: 'string', required: false, description: 'Phone number (min 10 digits) - automatically normalized to +1 format' },
        { name: 'address', type: 'string', required: false, description: 'Street address' },
        { name: 'city', type: 'string', required: false, description: 'City name' },
        { name: 'state', type: 'string', required: false, description: 'State/Province' },
        { name: 'zipCode', type: 'string', required: false, description: 'ZIP/Postal code' },

        // Marketing & Campaign Tracking
        { name: 'campaignId', type: 'string', required: false, description: 'Campaign identifier for tracking' },
        { name: 'utmSource', type: 'string', required: false, description: 'UTM source parameter' },
        { name: 'utmMedium', type: 'string', required: false, description: 'UTM medium parameter' },
        { name: 'utmCampaign', type: 'string', required: false, description: 'UTM campaign parameter' },

        // Solar-Related Fields
        { name: 'monthlyElectricBill', type: 'number', required: false, description: 'Monthly electric bill amount' },
        { name: 'propertyType', type: 'string', required: false, description: 'Property type (e.g., single-family, townhouse, condo, apartment, commercial)' },
        { name: 'roofCondition', type: 'string', required: false, description: 'Condition of roof (excellent, good, fair, poor)' },
        { name: 'roofAge', type: 'number', required: false, description: 'Age of roof in years (0-100)' },
        { name: 'shadeCoverage', type: 'string', required: false, description: 'Shade coverage on property (none, minimal, moderate, heavy)' },

        // HVAC-Related Fields
        { name: 'systemType', type: 'string', required: false, description: 'HVAC system type (central-air, heat-pump, ductless, window-unit, other)' },
        { name: 'systemAge', type: 'number', required: false, description: 'Age of current HVAC system in years (0-50)' },
        { name: 'serviceType', type: 'string', required: false, description: 'Type of service needed (installation, repair, maintenance, consultation)' },
        { name: 'urgency', type: 'string', required: false, description: 'Urgency level (immediate, within-week, within-month, planning)' },
        { name: 'propertySize', type: 'number', required: false, description: 'Property size in square feet' },

        // Insurance-Related Fields
        { name: 'policyType', type: 'string', required: false, description: 'Type of insurance policy (home, auto, life, business)' },
        { name: 'coverageAmount', type: 'number', required: false, description: 'Desired coverage amount' },
        { name: 'currentPremium', type: 'number', required: false, description: 'Current premium amount' },
        { name: 'propertyValue', type: 'number', required: false, description: 'Property value for insurance' },
        { name: 'claimsHistory', type: 'string', required: false, description: 'Claims history information' },

        // Analytics & Revenue
        { name: 'conversionScore', type: 'number', required: false, description: 'Conversion likelihood score (0-100)' },
        { name: 'revenuePotential', type: 'number', required: false, description: 'Estimated revenue potential' },

        // Additional Metadata (handled automatically)
        { name: 'notes', type: 'string', required: false, description: 'Additional notes about the lead' }
      ]
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">API Documentation</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Convio Leads Webhook API v1.0.0
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              api.homeprojectpartners.com
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="h-[calc(90vh-120px)]">
          <div className="border-b px-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="schemas">Schemas</TabsTrigger>
              <TabsTrigger value="deduplication">Deduplication</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="appointment-flow">Appointment Flow</TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-y-auto h-[calc(100%-48px)] px-6 py-4">
              <TabsContent value="overview" className="space-y-6 mt-0">
                <div>
                  <h3 className="text-lg font-semibold mb-3">API Overview</h3>
                  <p className="text-muted-foreground mb-4">
                    The Convio Leads Webhook API is a Cloudflare Workers-based service for receiving,
                    processing, and managing lead data from multiple third-party providers.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-green-500" />
                        Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        HMAC-SHA256 signature validation, rate limiting (100 req/min),
                        and comprehensive security headers.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-blue-500" />
                        Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Built on Cloudflare Workers for global edge performance
                        with D1 database integration.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Code2 className="w-4 h-4 text-purple-500" />
                        Features
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Multi-schema validation, status tracking, analytics,
                        and comprehensive lead lifecycle management.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Base URL</h4>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      https://api.homeprojectpartners.com
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard('https://api.homeprojectpartners.com')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Authentication</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Required:</strong> Provider authentication header for webhook POST requests:
                  </p>
                  <div className="bg-muted p-3 rounded-lg mb-3">
                    <code className="text-xs font-mono">
                      Authorization: &lt;provider_id&gt;
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Optional:</strong> Webhook signature validation using HMAC-SHA256:
                  </p>
                  <div className="bg-muted p-3 rounded-lg">
                    <code className="text-xs font-mono">
                      X-Webhook-Signature: sha256=&lt;signature&gt;
                    </code>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="endpoints" className="space-y-4 mt-0">
                {endpoints.map((endpoint) => (
                  <Card key={endpoint.id} className="overflow-hidden">
                    <CardHeader
                      className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setActiveEndpoint(activeEndpoint === endpoint.id ? null : endpoint.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              endpoint.method === 'GET' ? 'default' :
                              endpoint.method === 'POST' ? 'secondary' :
                              endpoint.method === 'DELETE' ? 'destructive' :
                              'outline'
                            }
                            className="font-mono text-xs"
                          >
                            {endpoint.method}
                          </Badge>
                          <div>
                            <CardTitle className="text-sm">{endpoint.title}</CardTitle>
                            <code className="text-xs text-muted-foreground">{endpoint.path}</code>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
                    </CardHeader>

                    {activeEndpoint === endpoint.id && (
                      <CardContent className="pt-0 space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-medium">Request Example</h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(endpoint.example)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
                              {endpoint.example}
                            </pre>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-medium">Response Example</h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(endpoint.response)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
                              {endpoint.response}
                            </pre>
                          </div>
                        </div>

                        {endpoint.errorResponses && endpoint.errorResponses.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium mb-2">Error Responses</h5>
                            <div className="space-y-3">
                              {endpoint.errorResponses.map((error, index) => (
                                <div key={index} className="border border-destructive/20 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="destructive" className="text-xs">
                                      {error.code}
                                    </Badge>
                                    <span className="text-sm font-medium">{error.title}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">{error.description}</p>
                                  <div className="bg-muted p-2 rounded overflow-x-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
                                      {error.response}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="schemas" className="space-y-6 mt-0">
                {schemas.map((schema) => (
                  <Card key={schema.name}>
                    <CardHeader>
                      <CardTitle className="text-lg">{schema.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{schema.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">JSON Schema Example</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(`{
  // Required Fields
  "firstname": "John",
  "lastname": "Doe",
  "source": "Google Ads",

  // Contact Information (optional but recommended)
  "phone": "5551234567",
  "email": "john.doe@example.com",
  "address1": "123 Main Street",
  "address2": "Apt 4B",
  "city": "Los Angeles",
  "state": "CA",
  "zip": "90210",

  // Business-Specific Fields
  "productid": "Solar",
  "subsource": "Solar Installation Campaign",
  "created_at": "2025-09-25T18:00:00.000Z",
  "landing_page_url": "https://solarpanel.com/ca-landing",

  // Consent & Compliance
  "consent": {
    "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
    "value": true
  },
  "tcpa_compliance": true
}`)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
{`{
  // Required Fields
  "firstname": "John",
  "lastname": "Doe",
  "source": "Google Ads",

  // Contact Information (optional but recommended)
  "phone": "5551234567",
  "email": "john.doe@example.com",
  "address1": "123 Main Street",
  "address2": "Apt 4B",
  "city": "Los Angeles",
  "state": "CA",
  "zip": "90210",

  // Business-Specific Fields
  "productid": "Solar",
  "subsource": "Solar Installation Campaign",
  "created_at": "2025-09-25T18:00:00.000Z",
  "landing_page_url": "https://solarpanel.com/ca-landing",

  // Consent & Compliance
  "consent": {
    "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
    "value": true
  },
  "tcpa_compliance": true
}`}
                        </pre>
                      </div>

                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Note:</strong> Only the required fields (firstname, lastname, source) are mandatory. Email and phone are highly recommended.
                          Include any combination of optional fields based on your lead type and available data.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="deduplication" className="space-y-6 mt-0">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Deduplication Strategy</h3>
                  <p className="text-muted-foreground mb-6">
                    Our lead deduplication system prevents duplicate contacts while preserving all business opportunities.
                    Learn how we handle duplicate leads intelligently using phone-based contact management.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Contact = Person
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        One contact per unique phone number per webhook. Contains personal info: name, phone, email, address.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-green-500" />
                        Lead = Inquiry
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Multiple leads per contact. Each represents a separate business opportunity or service inquiry.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">How It Works</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300 mt-0.5">
                        1
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Phone Normalization</h4>
                        <p className="text-xs text-muted-foreground">All phone numbers are normalized to +1XXXXXXXXXX format for consistent matching.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300 mt-0.5">
                        2
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Contact Detection</h4>
                        <p className="text-xs text-muted-foreground">System checks if phone number exists for the current webhook source.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-semibold text-green-600 dark:text-green-300 mt-0.5">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Smart Processing</h4>
                        <p className="text-xs text-muted-foreground">New contact = create both contact and lead. Existing contact = add new lead only.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">Response Examples</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">New Contact Created</h4>
                      <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
{`{
  "status": "success",
  "message": "New contact created and lead processed successfully",
  "webhook_id": "test-webhook_ws_us_general_172",
  "contact_id": 1,
  "lead_id": 4,
  "contact_status": "new",
  "next_steps": [
    "Lead data validated and normalized",
    "New contact created in database",
    "Lead stored and linked to contact",
    "Lead processing pipeline triggered"
  ]
}`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Lead Added to Existing Contact</h4>
                      <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
{`{
  "status": "success",
  "message": "Lead added to existing contact successfully",
  "webhook_id": "test-webhook_ws_us_general_172",
  "contact_id": 1,
  "lead_id": 5,
  "contact_status": "existing",
  "next_steps": [
    "Lead data validated and normalized",
    "Lead added to existing contact",
    "Lead stored and linked to contact",
    "Lead processing pipeline triggered"
  ]
}`}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Key Benefits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Shield className="w-4 h-4 text-blue-500 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium">No Duplicate Work</h4>
                          <p className="text-xs text-muted-foreground">Sales reps see complete customer history, avoiding redundant contact.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Zap className="w-4 h-4 text-green-500 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium">Multiple Opportunities</h4>
                          <p className="text-xs text-muted-foreground">Track separate inquiries for different services from same customer.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Code2 className="w-4 h-4 text-purple-500 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium">Automatic Processing</h4>
                          <p className="text-xs text-muted-foreground">No manual intervention needed - system handles duplicates intelligently.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Globe className="w-4 h-4 text-orange-500 mt-1" />
                        <div>
                          <h4 className="text-sm font-medium">Per-Webhook Isolation</h4>
                          <p className="text-xs text-muted-foreground">Same phone can exist across different webhooks for separate business units.</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="examples" className="space-y-6 mt-0">
                <div>
                  <h3 className="text-lg font-semibold mb-4">cURL Examples</h3>
                  <p className="text-muted-foreground mb-6">
                    Ready-to-use cURL commands for testing and integration with the Convio Leads API.
                  </p>

                  <div className="space-y-6">
                    {endpoints.map((endpoint) => (
                      <Card key={endpoint.id}>
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                endpoint.method === 'GET' ? 'default' :
                                endpoint.method === 'POST' ? 'secondary' :
                                endpoint.method === 'DELETE' ? 'destructive' :
                                'outline'
                              }
                              className="font-mono text-xs"
                            >
                              {endpoint.method}
                            </Badge>
                            <CardTitle className="text-base">{endpoint.title}</CardTitle>
                          </div>
                          <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">cURL Command</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(endpoint.example)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="bg-muted p-3 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground min-w-0">
                              {endpoint.example}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="appointment-flow" className="space-y-6 mt-0">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Appointment-as-a-Service: End-to-End Flow</h3>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-900">
                      <strong>HomeProjectPartners</strong> operates as an <strong>Appointment-as-a-Service</strong> platform that:
                    </p>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm text-blue-800">
                      <li>Receives raw leads from 3rd party lead providers</li>
                      <li>Converts those leads into qualified appointments</li>
                      <li>Routes appointments to client businesses based on matching criteria</li>
                      <li>Forwards appointment data to client systems via webhooks</li>
                    </ol>
                    <p className="text-sm text-blue-900 mt-2">
                      This creates a scalable lead-to-appointment pipeline where clients pay for qualified, scheduled appointments rather than raw leads.
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        Phase 1: Lead Ingestion
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   3rd Party     │    │   3rd Party     │    │   3rd Party     │
│   Provider A    │    │   Provider B    │    │   Provider C    │
│                 │    │                 │    │                 │
│ ├ Solar Leads   │    │ ├ HVAC Leads    │    │ ├ Kitchen Leads │
│ ├ Zip: 90210    │    │ ├ Zip: 10001    │    │ ├ Zip: 60601    │
│ └ $50-100/lead  │    │ └ $75-125/lead  │    │ └ $30-80/lead   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    WEBHOOK ENDPOINTS                        │
    │  POST /webhook/provider-a   POST /webhook/provider-b        │
    │  POST /webhook/provider-c   POST /leads/receive             │
    └─────────────────────────────────────────────────────────────┘`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Code2 className="h-5 w-5 text-blue-500" />
                        Phase 2: Data Processing & Storage
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
    ┌─────────────────────────────────────────────────────────────┐
    │           HOMEPROJECTPARTNERS API PROCESSING               │
    │                                                             │
    │  ┌─ Phone Number Normalization (+1XXXXXXXXXX)              │
    │  ├─ Contact Deduplication (phone + provider_id)            │
    │  ├─ Lead Classification & Validation                       │
    │  └─ Appointment Scheduling Logic                           │
    └─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE D1 DATABASE STORAGE                         │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │    CONTACTS     │  │      LEADS      │  │  APPOINTMENTS   │                │
│  │                 │  │                 │  │                 │                │
│  │ ├ id (PK)       │  │ ├ id (PK)       │  │ ├ id (PK)       │                │
│  │ ├ phone_normal  │  │ ├ contact_id    │  │ ├ lead_id       │                │
│  │ ├ provider_id   │  │ ├ source        │  │ ├ contact_id    │                │
│  │ ├ first_name    │  │ ├ product_type  │  │ ├ service_type  │                │
│  │ ├ last_name     │  │ ├ estimated_val │  │ ├ customer_zip  │                │
│  │ ├ email         │  │ ├ zip_code      │  │ ├ scheduled_at  │                │
│  │ └ created_at    │  │ └ created_at    │  │ ├ routing_match │                │
│  └─────────────────┘  └─────────────────┘  │ ├ workspace_id  │                │
│           │                     │           │ ├ forward_status│                │
│           └─────────────────────┼───────────┤ └ created_at    │                │
│                                 │           └─────────────────┘                │
│                                 └─────────────────────┘                        │
│                                                                                 │
│  Relationships:                                                                 │
│  • contacts.id → leads.contact_id (1:M)                                        │
│  • leads.id → appointments.lead_id (1:1)                                       │
│  • contacts.id → appointments.contact_id (1:M)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Globe className="h-5 w-5 text-green-500" />
                        Phase 3: Appointment Routing Engine
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ROUTING LOGIC ENGINE                                 │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      ROUTING CRITERIA MATCHING                         │   │
│  │                                                                         │   │
│  │  Input: service_type="Solar", customer_zip="90210"                     │   │
│  │                                                                         │   │
│  │  Query: SELECT * FROM appointment_routing_rules WHERE                  │   │
│  │         JSON_EXTRACT(product_types, '$') LIKE '%Solar%' AND            │   │
│  │         JSON_EXTRACT(zip_codes, '$') LIKE '%90210%' AND                │   │
│  │         is_active = 1 ORDER BY priority ASC LIMIT 1;                   │   │
│  │                                                                         │   │
│  │  Result: workspace_id = "solar_west_coast"                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      ROUTING RULES DATABASE                                    │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                    APPOINTMENT_ROUTING_RULES                             │  │
│  │                                                                          │  │
│  │  ├ id: 1                                                                 │  │
│  │  ├ workspace_id: "solar_west_coast"                                     │  │
│  │  ├ product_types: ["Solar", "Battery"]                                  │  │
│  │  ├ zip_codes: ["90210", "90211", "90212", ...]                         │  │
│  │  ├ priority: 1                                                          │  │
│  │  └ is_active: true                                                      │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-purple-500" />
                        Phase 4: Webhook Delivery to Clients
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WEBHOOK FORWARDING ENGINE                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PAYLOAD CONSTRUCTION                           │   │
│  │                                                                         │   │
│  │  {                                                                      │   │
│  │    "appointment_id": 12345,                                            │   │
│  │    "customer_name": "John Solar Customer",                             │   │
│  │    "customer_phone": "555-123-4567",                                   │   │
│  │    "customer_email": "john@example.com",                               │   │
│  │    "service_type": "Solar",                                            │   │
│  │    "customer_zip": "90210",                                            │   │
│  │    "appointment_date": "2024-12-01T14:00:00Z",                         │   │
│  │    "estimated_value": 25000,                                           │   │
│  │    "notes": "Interested in 10kW solar system",                         │   │
│  │    "routing_method": "auto",                                           │   │
│  │    "matched_at": "2024-01-15T10:30:00Z",                               │   │
│  │    "workspace_id": "solar_west_coast"                                  │   │
│  │  }                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT DELIVERY                                   │
│                                                                                 │
│  POST https://solar-client.com/webhooks/appts                                  │
│  Headers:                                                                       │
│  ├ Content-Type: application/json                                              │
│  ├ User-Agent: Convio-Appointment-Router/1.0                                   │
│  └ X-Webhook-Source: appointment-routing                                       │
│                                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐                         │
│  │  Solar Client   │◀─────────────│   HVAC Client   │                         │
│  │   Business      │   Webhook    │    Business     │                         │
│  │                 │   Delivery   │                 │                         │
│  │ ├ CRM System    │              │ ├ Scheduling    │                         │
│  │ ├ Lead Routing  │              │ ├ Sales Team    │                         │
│  │ ├ Sales Team    │              │ ├ Technicians   │                         │
│  │ └ $150/appt     │              │ └ $125/appt     │                         │
│  └─────────────────┘              └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-red-500" />
                        Database Relationships
                      </h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE RELATIONSHIP MAP                            │
└─────────────────────────────────────────────────────────────────────────────────┘

LEAD PROVIDER    →    CONTACTS    →    LEADS    →    APPOINTMENTS
     │                    │             │              │
     │                    │             │              ▼
     │                    │             │         ┌─────────────────┐
     │                    │             │         │  ROUTING RULES  │
     │                    │             │         │                 │
     │                    │             │         │ ├ workspace_id  │
     │                    │             │         │ ├ product_types │
     │                    │             │         │ ├ zip_codes     │
     │                    │             │         │ └ priority      │
     │                    │             │         └─────────────────┘
     │                    │             │              │
     │                    │             │              ▼
     │                    │             │         ┌─────────────────┐
     │                    │             │         │   WORKSPACES    │
     │                    │             │         │                 │
     │                    │             │         │ ├ id            │
     │                    │             │         │ ├ name          │
     │                    │             │         │ ├ webhook_url   │
     │                    │             │         │ └ webhook_active│
     │                    │             │         └─────────────────┘
     ▼                    ▼             ▼              ▼
┌──────────┐    ┌──────────────┐  ┌──────────┐  ┌─────────────────┐
│PROVIDERS │    │   CONTACTS   │  │  LEADS   │  │ APPOINTMENT     │
│          │    │              │  │          │  │    EVENTS       │
│├ id      │    │├ id (PK)     │  │├ id (PK) │  │                 │
│├ name    │    │├ phone_norm  │  │├ contact │  │├ appointment_id │
│├ webhook │    │├ provider_id │  │├ source  │  │├ event_type     │
│└ active  │    │├ first_name  │  │├ product │  │├ event_data     │
└──────────┘    │├ last_name   │  │├ est_val │  │├ metadata       │
     │          │├ email       │  │├ zip     │  │└ created_at     │
     │          │└ created_at  │  │└ created │  └─────────────────┘
     └──────────┤              │  └──────────┘
                └──────────────┘`}</pre>
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-lg font-semibold mb-3 text-green-900">Revenue Model</h4>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre leading-relaxed">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REVENUE FLOW                                      │
│                                                                                 │
│  LEAD COSTS          PROCESSING COSTS        CLIENT REVENUE                     │
│                                                                                 │
│  Provider A: $75  →  ┌─────────────────┐  →  Solar Team: $150/appt             │
│  Provider B: $50  →  │   HPP MARKUP    │  →  HVAC Team: $125/appt              │
│  Provider C: $60  →  │                 │  →  Kitchen Team: $100/appt            │
│                      │  ├ Qualification │                                       │
│                      │  ├ Scheduling    │  GROSS MARGIN                         │
│                      │  ├ Routing       │  = $150 - $75 = $75/appt             │
│                      │  └ Delivery      │  = 100% markup                        │
│                      └─────────────────┘                                       │
│                                                                                 │
│  CONVERSION METRICS:                                                            │
│  ├ Lead-to-Appointment Rate: 60-80%                                            │
│  ├ Appointment Delivery Rate: 95%+                                             │
│  ├ Client Acceptance Rate: 90%+                                                │
│  └ Revenue Recognition: Upon webhook delivery                                  │
└─────────────────────────────────────────────────────────────────────────────────┘`}</pre>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">System Capacity</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-xs space-y-1">
                            <li>• Lead Ingestion: 10,000+ leads/day</li>
                            <li>• Appointments: 6,000+ appts/day</li>
                            <li>• Routing Speed: &lt; 100ms</li>
                            <li>• Webhook Delivery: &lt; 2 seconds</li>
                            <li>• Database Queries: 50,000+/day</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Reliability Metrics</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-xs space-y-1">
                            <li>• Webhook Success: 99.5%</li>
                            <li>• Routing Accuracy: 99.8%</li>
                            <li>• System Uptime: 99.9%</li>
                            <li>• Data Consistency: 100%</li>
                            <li>• Retry Logic: 3 attempts</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="text-sm font-semibold mb-2 text-amber-900">Key Integration Points</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <strong className="text-amber-800">Inbound APIs:</strong>
                          <ul className="mt-1 space-y-1 text-amber-700">
                            <li>{`• POST /webhook/provider-{id}`}</li>
                            <li>• POST /leads/receive</li>
                            <li>• POST /appointments/receive</li>
                          </ul>
                        </div>
                        <div>
                          <strong className="text-amber-800">Outbound APIs:</strong>
                          <ul className="mt-1 space-y-1 text-amber-700">
                            <li>• Client webhook forwarding</li>
                            <li>• Real-time appointment delivery</li>
                            <li>• Delivery confirmation tracking</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ApiDocumentation;