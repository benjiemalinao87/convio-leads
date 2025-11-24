import { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Copy,
  ExternalLink,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Trash2,
  FileText,
  RotateCcw,
  Share2,
  LayoutGrid,
  List,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ApiDocumentation from '@/components/ApiDocumentation';
import SoftDeleteDialog from '@/components/webhooks/SoftDeleteDialog';
import SoftDeletedWebhooksPanel from '@/components/webhooks/SoftDeletedWebhooksPanel';
import { ForwardingManagementDialog } from '@/components/leads/ForwardingManagementDialog';
import { WebhookActivityLogModal } from '@/components/webhooks/WebhookActivityLogModal';
import { KPICard } from '@/components/dashboard/KPICard';
import { PageHeader } from '@/components/dashboard/PageHeader';

// API Webhook interface
interface APIWebhook {
  id: string;
  name: string;
  type: string;
  region: string;
  category: string;
  enabled: boolean;
  endpoints: {
    health: string;
    receive: string;
  };
  total_leads?: number;
  conversion_rate?: number;
  total_revenue?: number;
  created_at?: string;
  last_lead_at?: string;
}

// Webhook with statistics
interface WebhookWithStats {
  id: string;
  name: string;
  type: string;
  region: string;
  category: string;
  enabled: boolean;
  webhook_url: string;
  created_at: string;
  total_leads: number;
  conversion_rate: number;
  total_revenue: number;
  status: 'active' | 'new' | 'disabled';
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApiDocOpen, setIsApiDocOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletedWebhooksPanelOpen, setIsDeletedWebhooksPanelOpen] = useState(false);
  const [isForwardingDialogOpen, setIsForwardingDialogOpen] = useState(false);
  const [selectedWebhookForDeletion, setSelectedWebhookForDeletion] = useState<WebhookWithStats | null>(null);
  const [selectedWebhookForForwarding, setSelectedWebhookForForwarding] = useState<WebhookWithStats | null>(null);
  const [selectedWebhookForActivity, setSelectedWebhookForActivity] = useState<WebhookWithStats | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const { toast } = useToast();

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch webhook configurations
      const webhooksResponse = await fetch(`${API_BASE}/webhook`);
      if (!webhooksResponse.ok) {
        throw new Error('Failed to fetch webhooks');
      }
      const webhooksData = await webhooksResponse.json();

      // Use real statistics from the API response
      const webhooksWithStats = webhooksData.webhooks.map((webhook: APIWebhook) => {
        const getStatus = () => {
          if (!webhook.enabled) return 'disabled' as const;
          return (webhook.total_leads || 0) > 0 ? 'active' as const : 'new' as const;
        };

        return {
          id: webhook.id,
          name: webhook.name,
          type: webhook.type,
          region: webhook.region,
          category: webhook.category,
          enabled: webhook.enabled,
          webhook_url: `${API_BASE}${webhook.endpoints.receive}`,
          created_at: webhook.created_at || new Date().toISOString(),
          total_leads: webhook.total_leads || 0,
          conversion_rate: webhook.conversion_rate || 0,
          total_revenue: webhook.total_revenue || 0,
          status: getStatus(),
        };
      });

      setWebhooks(webhooksWithStats);
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookName.trim()) return;

    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newWebhookName,
          type: 'lead',
          region: 'us', // Default region - could be made configurable
          category: 'general' // Default category - could be made configurable
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create webhook');
      }

      const result = await response.json();
      
      toast({
        title: "Webhook Created",
        description: `${newWebhookName} has been configured successfully with ID: ${result.webhook?.id}`,
      });

      setNewWebhookName('');
      setIsCreateDialogOpen(false);
      
      // Refresh the webhooks list
      await fetchWebhooks();
      
    } catch (error) {
      console.error('Failed to create webhook:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : 'Failed to create webhook',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWebhook = (webhook: WebhookWithStats) => {
    setSelectedWebhookForDeletion(webhook);
    setIsDeleteDialogOpen(true);
  };

  const handleManageForwarding = (webhook: WebhookWithStats) => {
    setSelectedWebhookForForwarding(webhook);
    setIsForwardingDialogOpen(true);
  };

  const handleDeleteConfirm = async (webhookId: string, reason: string, forceDelete: boolean) => {
    try {
      const params = new URLSearchParams();
      if (forceDelete) params.append('force', 'true');
      if (reason) params.append('reason', reason);

      const response = await fetch(`${API_BASE}/webhook/${webhookId}?${params}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'admin-user' // This should come from auth context
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete webhook');
      }

      const result = await response.json();

      toast({
        title: forceDelete ? "Webhook Deleted Permanently" : "Webhook Scheduled for Deletion",
        description: forceDelete
          ? `${selectedWebhookForDeletion?.name} has been deleted permanently.`
          : `${selectedWebhookForDeletion?.name} will be deleted in 24 hours. You can restore it until then.`,
      });

      setIsDeleteDialogOpen(false);
      setSelectedWebhookForDeletion(null);

      // Refresh the webhooks list
      await fetchWebhooks();

    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : 'Failed to delete webhook',
        variant: "destructive",
      });
    }
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied to Clipboard",
      description: "Webhook URL copied successfully.",
    });
  };

  const handleToggleWebhook = async (webhookId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/webhook/${webhookId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !currentEnabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update webhook status');
      }

      const result = await response.json();

      toast({
        title: "Webhook Updated",
        description: `Webhook has been ${!currentEnabled ? 'enabled' : 'disabled'} successfully.`,
      });

      // Refresh the webhooks list
      await fetchWebhooks();

    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : 'Failed to update webhook status',
        variant: "destructive",
      });
    }
  };

  // Calculate summary statistics
  const totalLeads = webhooks.reduce((sum, w) => sum + w.total_leads, 0);
  const totalRevenue = webhooks.reduce((sum, w) => sum + w.total_revenue, 0);
  const avgConversionRate = webhooks.length > 0 
    ? webhooks.reduce((sum, w) => sum + w.conversion_rate, 0) / webhooks.length 
    : 0;
  const activeWebhooks = webhooks.filter(w => w.enabled && w.status === 'active').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Webhooks"
          description="Manage your webhook endpoints for automated lead collection"
          actions={
            <div className="flex gap-2">
              <Button
                onClick={() => setIsDeletedWebhooksPanelOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                View Deleted
              </Button>
              <Button
                onClick={() => setIsApiDocOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                API Docs
              </Button>
              <Button
                onClick={fetchWebhooks}
                disabled={isLoading}
                variant="outline"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          }
        />

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Webhooks"
            value={webhooks.length}
            subtitle={`${activeWebhooks} active`}
            icon={Activity}
            iconColor="text-blue-600"
          />
          <KPICard
            title="Total Leads"
            value={totalLeads.toLocaleString()}
            subtitle="Across all webhooks"
            icon={Users}
            iconColor="text-green-600"
          />
          <KPICard
            title="Total Revenue"
            value={`$${totalRevenue.toLocaleString()}`}
            subtitle="Generated revenue"
            icon={DollarSign}
            iconColor="text-emerald-600"
          />
          <KPICard
            title="Avg Conversion"
            value={`${avgConversionRate.toFixed(1)}%`}
            subtitle="Average conversion rate"
            icon={TrendingUp}
            iconColor="text-purple-600"
          />
        </div>

        {/* Error state */}
        {error && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error: {error}</p>
              <Button onClick={fetchWebhooks} className="mt-2" size="sm">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Webhook List</h2>
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
            {webhooks.map((webhook) => (
              <Card key={webhook.id} className="bg-card rounded-xl border border-border p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-0.5 truncate">{webhook.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(webhook.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <Badge variant={
                    webhook.status === 'active' ? "default" :
                    webhook.status === 'disabled' ? "destructive" : "secondary"
                  } className="text-xs">
                    {webhook.status === 'active' ? "Active" :
                     webhook.status === 'disabled' ? "Disabled" : "New"}
                  </Badge>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={() => handleToggleWebhook(webhook.id, webhook.enabled)}
                    disabled={isLoading}
                    className="data-[state=checked]:bg-primary scale-75"
                  />
                </div>
              </div>

              {/* Compact Stats */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Users className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{webhook.total_leads}</p>
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <TrendingUp className="w-3.5 h-3.5 text-success mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">{webhook.conversion_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">Conv</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">${(webhook.total_revenue / 1000).toFixed(0)}k</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Activity className="w-3.5 h-3.5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-foreground">-</p>
                  <p className="text-[10px] text-muted-foreground">Activity</p>
                </div>
              </div>

              {/* Compact Webhook URL */}
              <div className="border border-border/50 rounded-lg p-2 bg-secondary/20 mb-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Webhook URL</Label>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyWebhookUrl(webhook.webhook_url)}
                      className="h-5 w-5 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-foreground truncate">
                  {webhook.webhook_url}
                </p>
              </div>

              {/* Compact Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleManageForwarding(webhook)}
                  className="flex-1 h-8 text-xs"
                >
                  <Share2 className="w-3 h-3 mr-1.5" />
                  Forwarding
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedWebhookForActivity(webhook);
                    setIsActivityLogOpen(true);
                  }}
                  className="flex-1 h-8 text-xs"
                >
                  <Activity className="w-3 h-3 mr-1.5" />
                  Activity
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteWebhook(webhook)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                  title="Delete webhook"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <Card className="bg-card rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          webhook.status === 'active' ? "default" :
                          webhook.status === 'disabled' ? "destructive" : "secondary"
                        }>
                          {webhook.status === 'active' ? "Active" :
                           webhook.status === 'disabled' ? "Disabled" : "New"}
                        </Badge>
                        <Switch
                          checked={webhook.enabled}
                          onCheckedChange={() => handleToggleWebhook(webhook.id, webhook.enabled)}
                          disabled={isLoading}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </TableCell>
                    <TableCell>{webhook.total_leads.toLocaleString()}</TableCell>
                    <TableCell>{webhook.conversion_rate.toFixed(1)}%</TableCell>
                    <TableCell>${webhook.total_revenue.toLocaleString()}</TableCell>
                    <TableCell>{new Date(webhook.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyWebhookUrl(webhook.webhook_url)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageForwarding(webhook)}
                          className="h-8 w-8 p-0"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && webhooks.length === 0 && !error && (
          <Card className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <ExternalLink className="w-12 h-12 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Webhooks Configured</h3>
            <p className="text-muted-foreground mb-6">
              Create your first webhook endpoint to start collecting leads automatically.
            </p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Webhook
            </Button>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && webhooks.length === 0 && (
          <Card className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <RefreshCw className="w-12 h-12 text-primary-foreground animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Loading Webhooks</h3>
            <p className="text-muted-foreground">
              Fetching webhook configurations from the API...
            </p>
          </Card>
        )}

        {/* Create Webhook Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook-name">Webhook Name</Label>
                <Input
                  id="webhook-name"
                  value={newWebhookName}
                  onChange={(e) => setNewWebhookName(e.target.value)}
                  placeholder="e.g., Solar Leads - Texas"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWebhook}
                  disabled={!newWebhookName.trim() || isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create Webhook'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* API Documentation Dialog */}
        <ApiDocumentation
          open={isApiDocOpen}
          onOpenChange={setIsApiDocOpen}
        />

        {/* Soft Delete Dialog */}
        {selectedWebhookForDeletion && (
          <SoftDeleteDialog
            isOpen={isDeleteDialogOpen}
            onClose={() => {
              setIsDeleteDialogOpen(false);
              setSelectedWebhookForDeletion(null);
            }}
            webhookId={selectedWebhookForDeletion.id}
            webhookName={selectedWebhookForDeletion.name}
            onDeleteConfirm={handleDeleteConfirm}
            isDeleting={isLoading}
          />
        )}

        {/* Soft Deleted Webhooks Panel */}
        <SoftDeletedWebhooksPanel
          isOpen={isDeletedWebhooksPanelOpen}
          onClose={() => setIsDeletedWebhooksPanelOpen(false)}
          onWebhookRestored={fetchWebhooks}
        />

        {/* Lead Forwarding Management Dialog */}
        {selectedWebhookForForwarding && (
          <ForwardingManagementDialog
            webhookId={selectedWebhookForForwarding.id}
            webhookName={selectedWebhookForForwarding.name}
            open={isForwardingDialogOpen}
            onOpenChange={(open) => {
              setIsForwardingDialogOpen(open);
              if (!open) {
                setSelectedWebhookForForwarding(null);
              }
            }}
          />
        )}

        {/* Activity Log Modal */}
        {selectedWebhookForActivity && (
          <WebhookActivityLogModal
            webhookId={selectedWebhookForActivity.id}
            webhookName={selectedWebhookForActivity.name}
            open={isActivityLogOpen}
            onOpenChange={(open) => {
              setIsActivityLogOpen(open);
              if (!open) {
                setSelectedWebhookForActivity(null);
              }
            }}
          />
        )}
      </div>
    </Layout>
  );
}
