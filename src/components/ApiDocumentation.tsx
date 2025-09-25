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
      description: 'Submit lead data via webhook',
      example: `curl -X POST https://api.homeprojectpartners.com/webhook/ws_cal_solar_001 \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: sha256=abc123..." \\
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "source": "Google Ads",
    "monthlyElectricBill": 250,
    "propertyType": "single-family"
  }'`,
      response: `{
  "status": "success",
  "message": "Lead received and processed successfully",
  "webhook_id": "ws_cal_solar_001",
  "contact_id": 12345,
  "email": "john.doe@example.com",
  "processed_at": "2024-09-24T21:00:00.000Z",
  "next_steps": [
    "Lead data validated and normalized",
    "Lead stored in database",
    "Lead processing pipeline triggered"
  ]
}`
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
      title: 'Search by Phone',
      description: 'Search for contacts by phone number with automatic normalization',
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
      id: 'delete-contact',
      method: 'DELETE',
      path: '/leads/contact/:contactId',
      title: 'Delete Contact',
      description: 'Delete a contact and ALL associated leads with cascade deletion',
      example: `curl -X DELETE "https://api.homeprojectpartners.com/leads/contact/1"`,
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
    }
  ];

  const schemas = [
    {
      name: 'Complete Lead Schema',
      description: 'All available fields for lead data - use any combination based on your lead type',
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="schemas">Schemas</TabsTrigger>
              <TabsTrigger value="deduplication">Deduplication</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
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
                    Optional webhook signature validation using HMAC-SHA256:
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
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "source": "Google Ads",

  // Contact Information (optional)
  "phone": "555-123-4567",
  "address": "123 Main Street",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90210",

  // Marketing & Campaign Tracking (optional)
  "campaignId": "summer_2024_solar",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "solar_leads_ca",

  // Solar-Related Fields (optional)
  "monthlyElectricBill": 250,
  "propertyType": "single-family",
  "roofCondition": "good",
  "roofAge": 8,
  "shadeCoverage": "minimal",

  // HVAC-Related Fields (optional)
  "systemType": "central-air",
  "systemAge": 12,
  "serviceType": "installation",
  "urgency": "within-month",
  "propertySize": 2400,

  // Insurance-Related Fields (optional)
  "policyType": "home",
  "coverageAmount": 500000,
  "currentPremium": 1200,
  "propertyValue": 750000,
  "claimsHistory": "No claims in past 5 years",

  // Analytics & Revenue (optional)
  "conversionScore": 85,
  "revenuePotential": 25000,

  // Additional Metadata (optional)
  "notes": "Interested in solar installation, prefers financing options"
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
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "source": "Google Ads",

  // Contact Information (optional)
  "phone": "555-123-4567",
  "address": "123 Main Street",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90210",

  // Marketing & Campaign Tracking (optional)
  "campaignId": "summer_2024_solar",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "solar_leads_ca",

  // Solar-Related Fields (optional)
  "monthlyElectricBill": 250,
  "propertyType": "single-family",
  "roofCondition": "good",
  "roofAge": 8,
  "shadeCoverage": "minimal",

  // HVAC-Related Fields (optional)
  "systemType": "central-air",
  "systemAge": 12,
  "serviceType": "installation",
  "urgency": "within-month",
  "propertySize": 2400,

  // Insurance-Related Fields (optional)
  "policyType": "home",
  "coverageAmount": 500000,
  "currentPremium": 1200,
  "propertyValue": 750000,
  "claimsHistory": "No claims in past 5 years",

  // Analytics & Revenue (optional)
  "conversionScore": 85,
  "revenuePotential": 25000,

  // Additional Metadata (optional)
  "notes": "Interested in solar installation, prefers financing options"
}`}
                        </pre>
                      </div>

                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Note:</strong> Only the required fields (firstName, lastName, email, source) are mandatory.
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
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ApiDocumentation;