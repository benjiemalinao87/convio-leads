import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Settings,
  Webhook,
  Building,
  Link,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Info,
  MoreHorizontal,
  Trash2,
  Plus,
  Copy,
  Key
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Workspace {
  id: string;
  name: string;
  outbound_webhook_url?: string;
  webhook_active: boolean;
  api_key?: string;
}

interface AppointmentRoutingManagerProps {
  onRefresh: () => void;
}

export function AppointmentRoutingManager({ onRefresh }: AppointmentRoutingManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch workspaces from API
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.homeprojectpartners.com/conversions/workspaces');
      const data = await response.json();

      if (data.success) {
        setWorkspaces(data.workspaces || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load workspace settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleUpdateWebhook = async (workspaceId: string, webhookUrl: string, isActive: boolean) => {
    try {
      setUpdating(workspaceId);

      const response = await fetch(`https://api.homeprojectpartners.com/conversions/workspace/${workspaceId}/webhook`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outbound_webhook_url: webhookUrl,
          webhook_active: isActive,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state with the saved data
        setWorkspaces(prev =>
          prev.map(workspace =>
            workspace.id === workspaceId
              ? {
                  ...workspace,
                  outbound_webhook_url: data.workspace.outbound_webhook_url,
                  webhook_active: data.workspace.webhook_active
                }
              : workspace
          )
        );

        toast({
          title: "Success",
          description: "Workspace webhook settings saved to database",
        });

        onRefresh();
      } else {
        toast({
          title: "Error",
          description: data.message || data.error || "Failed to save webhook settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleTestWebhook = async (workspaceId: string, webhookUrl: string) => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL first",
        variant: "destructive",
      });
      return;
    }

    try {
      setTestingWebhook(workspaceId);

      // Send a test appointment to the webhook
      const testAppointment = {
        appointment_id: 999999,
        customer_name: "Test Customer",
        customer_phone: "555-000-0000",
        customer_email: "test@example.com",
        service_type: "Test Service",
        customer_zip: "12345",
        appointment_date: new Date().toISOString(),
        estimated_value: 1000,
        notes: "This is a test appointment from the routing system",
        test_webhook: true
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testAppointment),
      });

      if (response.ok) {
        toast({
          title: "Webhook Test Successful",
          description: "Test appointment was sent successfully",
        });
      } else {
        toast({
          title: "Webhook Test Failed",
          description: `Server responded with status ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: "Webhook Test Failed",
        description: "Failed to connect to webhook URL",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string, workspaceName: string) => {
    try {
      setDeleting(workspaceId);
      const response = await fetch(`https://api.homeprojectpartners.com/conversions/workspace/${workspaceId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Workspace "${workspaceName}" deleted successfully`,
        });
        fetchWorkspaces(); // Refresh the workspace list
        onRefresh(); // Refresh parent data
      } else {
        toast({
          title: "Error",
          description: data.message || data.error || "Failed to delete workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const copyApiKey = async (apiKey: string, workspaceName: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast({
        title: "API Key Copied",
        description: `${workspaceName} API key copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy API key to clipboard",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (workspace: Workspace) => {
    if (!workspace.outbound_webhook_url) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800">
          <XCircle className="h-3 w-3 mr-1" />
          No URL
        </Badge>
      );
    }

    if (workspace.webhook_active) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
          <XCircle className="h-3 w-3 mr-1" />
          Inactive
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading workspace settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Appointment Routing Settings
          </CardTitle>
          <CardDescription>
            Configure webhook endpoints for forwarding appointments to client systems
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> When appointments are received and routed to a workspace,
          they will be automatically forwarded to the configured webhook URL if active.
          The appointment data is sent as JSON to the client's endpoint.
        </AlertDescription>
      </Alert>

      {/* Workspace Settings */}
      <div className="space-y-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{workspace.name}</CardTitle>
                  {getStatusBadge(workspace)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestWebhook(workspace.id, workspace.outbound_webhook_url || '')}
                    disabled={!workspace.outbound_webhook_url || testingWebhook === workspace.id}
                  >
                    {testingWebhook === workspace.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Test Webhook
                      </>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Routing Rule
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-red-600"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Workspace
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{workspace.name}"? This action cannot be undone.
                              <br /><br />
                              <strong>Note:</strong> Workspaces with active routing rules or appointments cannot be deleted.
                              You must first delete all routing rules and ensure no appointments are assigned to this workspace.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteWorkspace(workspace.id, workspace.name)}
                              disabled={deleting === workspace.id}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deleting === workspace.id ? 'Deleting...' : 'Delete Workspace'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* API Key Section */}
              {workspace.api_key && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">API Key</Label>
                      </div>
                      <code className="text-xs font-mono text-muted-foreground truncate block max-w-md">
                        {workspace.api_key}
                      </code>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyApiKey(workspace.api_key!, workspace.name)}
                    className="h-8 px-3 flex-shrink-0"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor={`webhook-url-${workspace.id}`}>
                    Outbound Webhook URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`webhook-url-${workspace.id}`}
                      type="url"
                      placeholder="https://your-client-system.com/webhook/appointments"
                      value={workspace.outbound_webhook_url || ''}
                      onChange={(e) => {
                        setWorkspaces(prev =>
                          prev.map(w =>
                            w.id === workspace.id
                              ? { ...w, outbound_webhook_url: e.target.value }
                              : w
                          )
                        );
                      }}
                    />
                  </div>
                  {workspace.outbound_webhook_url && (
                    <p className="text-xs text-muted-foreground">
                      Appointments routed to this workspace will be forwarded to this URL
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`webhook-active-${workspace.id}`}
                      checked={workspace.webhook_active}
                      onCheckedChange={(checked) => {
                        setWorkspaces(prev =>
                          prev.map(w =>
                            w.id === workspace.id
                              ? { ...w, webhook_active: checked }
                              : w
                          )
                        );
                      }}
                      disabled={!workspace.outbound_webhook_url}
                    />
                    <Label htmlFor={`webhook-active-${workspace.id}`}>
                      Active
                    </Label>
                  </div>

                  <Button
                    onClick={() =>
                      handleUpdateWebhook(
                        workspace.id,
                        workspace.outbound_webhook_url || '',
                        workspace.webhook_active
                      )
                    }
                    disabled={updating === workspace.id}
                    size="sm"
                    className="w-full"
                  >
                    {updating === workspace.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Settings'
                    )}
                  </Button>
                </div>
              </div>

              {!workspace.outbound_webhook_url && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-600">
                    No webhook URL configured. Appointments routed to this workspace will not be forwarded.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook Payload Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Payload Format
          </CardTitle>
          <CardDescription>
            This is the JSON structure that will be sent to your webhook endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">{`{
  "appointment_id": 123,
  "customer_name": "John Doe",
  "customer_phone": "555-123-4567",
  "customer_email": "john@example.com",
  "service_type": "Solar",
  "customer_zip": "90210",
  "appointment_date": "2024-10-01T14:00:00Z",
  "estimated_value": 25000,
  "notes": "Customer interested in rooftop solar installation",
  "routing_method": "auto",
  "matched_at": "2024-01-15T10:30:00Z",
  "workspace_id": "default_workspace"
}`}</pre>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Headers sent:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><code>Content-Type: application/json</code></li>
              <li><code>User-Agent: Convio-Appointment-Router/1.0</code></li>
              <li><code>X-Webhook-Source: appointment-routing</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}