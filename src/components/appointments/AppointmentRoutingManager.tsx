import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  Building,
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
  Key,
  LayoutGrid,
  List,
  Calendar,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
  outbound_webhook_url?: string;
  webhook_active: boolean;
  api_key?: string;
  total_appointments?: number;
  pending_appointments?: number;
  confirmed_appointments?: number;
  completed_appointments?: number;
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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch appointment statistics for a workspace
  const fetchWorkspaceAppointmentStats = async (workspaceId: string) => {
    try {
      const response = await fetch(`https://api.homeprojectpartners.com/appointments?workspace_id=${workspaceId}&limit=1`);
      const data = await response.json();

      if (data.success) {
        // Get total count from pagination
        const total = data.pagination?.total || 0;

        // Fetch appointments by status for breakdown
        const [pendingRes, confirmedRes, completedRes] = await Promise.all([
          fetch(`https://api.homeprojectpartners.com/appointments?workspace_id=${workspaceId}&status=pending&limit=1`),
          fetch(`https://api.homeprojectpartners.com/appointments?workspace_id=${workspaceId}&status=confirmed&limit=1`),
          fetch(`https://api.homeprojectpartners.com/appointments?workspace_id=${workspaceId}&status=completed&limit=1`)
        ]);

        const [pendingData, confirmedData, completedData] = await Promise.all([
          pendingRes.json(),
          confirmedRes.json(),
          completedRes.json()
        ]);

        return {
          total_appointments: total,
          pending_appointments: pendingData.pagination?.total || 0,
          confirmed_appointments: confirmedData.pagination?.total || 0,
          completed_appointments: completedData.pagination?.total || 0,
        };
      }
    } catch (error) {
      console.error(`Error fetching appointment stats for workspace ${workspaceId}:`, error);
    }
    return {
      total_appointments: 0,
      pending_appointments: 0,
      confirmed_appointments: 0,
      completed_appointments: 0,
    };
  };

  // Fetch workspaces from API
  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.homeprojectpartners.com/conversions/workspaces');
      const data = await response.json();

      if (data.success) {
        const workspaces = data.workspaces || [];
        
        // Fetch appointment statistics for each workspace
        const workspacesWithStats = await Promise.all(
          workspaces.map(async (workspace: Workspace) => {
            const stats = await fetchWorkspaceAppointmentStats(workspace.id);
            return { ...workspace, ...stats };
          })
        );

        setWorkspaces(workspacesWithStats);
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
        <span>Loading workspaces...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Workspaces"
        description="Manage workspaces and configure webhook endpoints for appointment forwarding"
        actions={
          <div className="flex gap-2">
            <Button
              onClick={fetchWorkspaces}
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </Button>
          </div>
        }
      />

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> When appointments are received and routed to a workspace,
          they will be automatically forwarded to the configured webhook URL if active.
          The appointment data is sent as JSON to the client's endpoint.
        </AlertDescription>
      </Alert>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Workspace List</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('card')}
            className="flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="bg-card rounded-xl border border-border p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-0.5 truncate">{workspace.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate">{workspace.id}</p>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  {getStatusBadge(workspace)}
                </div>
              </div>

              {/* Appointment Stats */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Calendar className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{workspace.total_appointments || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Clock className="w-3.5 h-3.5 text-warning mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{workspace.pending_appointments || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{workspace.confirmed_appointments || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Confirmed</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{workspace.completed_appointments || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Completed</p>
                </div>
              </div>

              {/* API Key */}
              {workspace.api_key && (
                <div className="border border-border/50 rounded-lg p-2 bg-secondary/20 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] font-medium text-muted-foreground">API Key</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyApiKey(workspace.api_key!, workspace.name)}
                      className="h-5 w-5 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <code className="text-[10px] font-mono text-foreground break-all bg-background/50 p-1 rounded border line-clamp-1">
                    {workspace.api_key}
                  </code>
                </div>
              )}

              {/* Webhook URL */}
              <div className="border border-border/50 rounded-lg p-2 bg-secondary/20 mb-3">
                <Label className="text-[10px] font-medium text-muted-foreground mb-1 block">Webhook URL</Label>
                <Input
                  type="url"
                  placeholder="https://..."
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
                  className="h-7 text-xs mb-2"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
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
                      className="data-[state=checked]:bg-primary scale-75"
                    />
                    <Label className="text-xs">Active</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestWebhook(workspace.id, workspace.outbound_webhook_url || '')}
                    disabled={!workspace.outbound_webhook_url || testingWebhook === workspace.id}
                    className="h-6 px-2 text-xs"
                  >
                    {testingWebhook === workspace.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
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
                  className="flex-1 h-8 text-xs"
                >
                  {updating === workspace.id ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update'
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
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
            </Card>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="bg-card rounded-xl border border-border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Appointments</TableHead>
                  <TableHead>Webhook URL</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{workspace.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{workspace.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(workspace)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-xs font-semibold text-foreground">{workspace.total_appointments || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Total</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-foreground">{workspace.pending_appointments || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Pending</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-foreground">{workspace.confirmed_appointments || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Confirmed</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-foreground">{workspace.completed_appointments || 0}</p>
                            <p className="text-[10px] text-muted-foreground">Done</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Input
                          type="url"
                          placeholder="https://..."
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
                          className="h-8 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Switch
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
                            className="data-[state=checked]:bg-primary scale-75"
                          />
                          <Label className="text-xs">Active</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestWebhook(workspace.id, workspace.outbound_webhook_url || '')}
                            disabled={!workspace.outbound_webhook_url || testingWebhook === workspace.id}
                            className="h-6 px-2 text-xs"
                          >
                            {testingWebhook === workspace.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {workspace.api_key ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                            {workspace.api_key}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyApiKey(workspace.api_key!, workspace.name)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No API key</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
                          className="h-8 text-xs"
                        >
                          {updating === workspace.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            'Update'
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
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
                    </TableCell>
                  </TableRow>
                ))}
                {workspaces.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No workspaces found. Create your first workspace to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && workspaces.length === 0 && (
        <Card className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
            <Building className="w-12 h-12 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Workspaces Configured</h3>
          <p className="text-muted-foreground mb-6">
            Create your first workspace to start routing appointments to client systems.
          </p>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Workspace
          </Button>
        </Card>
      )}

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchWorkspaces}
      />

    </div>
  );
}