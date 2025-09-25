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
    }
  ];

  const schemas = [
    {
      name: 'Base Lead Schema',
      description: 'Common fields for all lead types',
      fields: [
        { name: 'firstName', type: 'string', required: true, description: 'First name of the lead' },
        { name: 'lastName', type: 'string', required: true, description: 'Last name of the lead' },
        { name: 'email', type: 'string', required: false, description: 'Email address (validated if provided)' },
        { name: 'phone', type: 'string', required: false, description: 'Phone number (min 10 digits)' },
        { name: 'address', type: 'string', required: false, description: 'Street address' },
        { name: 'city', type: 'string', required: false, description: 'City' },
        { name: 'state', type: 'string', required: false, description: 'State/Province' },
        { name: 'zipCode', type: 'string', required: false, description: 'ZIP/Postal code' },
        { name: 'source', type: 'string', required: true, description: 'Lead source (e.g., "Google Ads")' }
      ]
    },
    {
      name: 'Solar Lead Schema',
      description: 'Additional fields for solar leads',
      fields: [
        { name: 'propertyType', type: 'enum', required: false, description: 'single-family | townhouse | condo | apartment | commercial' },
        { name: 'monthlyElectricBill', type: 'number', required: false, description: 'Monthly electric bill amount' },
        { name: 'roofCondition', type: 'enum', required: false, description: 'excellent | good | fair | poor' },
        { name: 'roofAge', type: 'number', required: false, description: 'Age of roof in years (0-100)' },
        { name: 'shadeIssues', type: 'boolean', required: false, description: 'Property has shade issues' }
      ]
    },
    {
      name: 'HVAC Lead Schema',
      description: 'Additional fields for HVAC leads',
      fields: [
        { name: 'serviceType', type: 'enum', required: false, description: 'installation | repair | maintenance | consultation' },
        { name: 'systemAge', type: 'number', required: false, description: 'Age of current system (0-50 years)' },
        { name: 'systemType', type: 'enum', required: false, description: 'central-air | heat-pump | ductless | window-unit | other' },
        { name: 'urgency', type: 'enum', required: false, description: 'immediate | within-week | within-month | planning' }
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="schemas">Schemas</TabsTrigger>
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
                            variant={endpoint.method === 'GET' ? 'default' : endpoint.method === 'POST' ? 'secondary' : 'outline'}
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
                      <div className="space-y-3">
                        {schema.fields.map((field) => (
                          <div key={field.name} className="flex items-start gap-4 py-2 border-b border-border/50 last:border-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <code className="text-sm font-mono font-medium">{field.name}</code>
                                {field.required && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{field.description}</p>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono shrink-0">
                              {field.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                              variant={endpoint.method === 'GET' ? 'default' : endpoint.method === 'POST' ? 'secondary' : 'outline'}
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