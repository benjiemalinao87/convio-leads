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
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ApiDocumentation from '@/components/ApiDocumentation';
import SoftDeleteDialog from '@/components/webhooks/SoftDeleteDialog';
import SoftDeletedWebhooksPanel from '@/components/webhooks/SoftDeletedWebhooksPanel';

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
  const [selectedWebhookForDeletion, setSelectedWebhookForDeletion] = useState<WebhookWithStats | null>(null);
  const [newWebhookName, setNewWebhookName] = useState('');
  const { toast } = useToast();

  const API_BASE = 'https://convio-leads-webhook-api.curly-king-877d.workers.dev';

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

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Webhooks</h1>
            <p className="text-muted-foreground mt-1">
              Manage your webhook endpoints for automated lead collection
            </p>
          </div>
          
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
              API Documentation
            </Button>
            <Button
              onClick={fetchWebhooks}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Webhook
            </Button>
          </div>
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

        {/* Webhooks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="glass-card p-6 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{webhook.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(webhook.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    webhook.status === 'active' ? "default" :
                    webhook.status === 'disabled' ? "destructive" : "secondary"
                  }>
                    {webhook.status === 'active' ? "Active" :
                     webhook.status === 'disabled' ? "Disabled" : "New"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={() => handleToggleWebhook(webhook.id, webhook.enabled)}
                      disabled={isLoading}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteWebhook(webhook)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      title="Delete webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Leads</p>
                    <p className="font-semibold text-foreground">{webhook.total_leads}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conversion</p>
                    <p className="font-semibold text-foreground">{webhook.conversion_rate}%</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-warning" />
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="font-semibold text-foreground">${webhook.total_revenue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Time</p>
                    <p className="font-semibold text-foreground">2.4 days</p>
                  </div>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="border border-border/50 rounded-lg p-3 bg-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">Webhook URL</Label>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyWebhookUrl(webhook.webhook_url)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs font-mono text-foreground break-all bg-background/50 p-2 rounded border">
                  {webhook.webhook_url}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && webhooks.length === 0 && !error && (
          <Card className="glass-card p-12 text-center">
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
          <Card className="glass-card p-12 text-center">
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
      </div>
    </Layout>
  );
}
