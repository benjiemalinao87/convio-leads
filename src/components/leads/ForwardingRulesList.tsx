import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MapPin,
  Package,
  RefreshCw,
  Share2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Power,
  AlertTriangle,
  Target,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { CreateForwardingRuleDialog } from './CreateForwardingRuleDialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ForwardingRule {
  id: number;
  source_webhook_id: string;
  target_webhook_id: string;
  target_webhook_url: string;
  product_types: string[];
  zip_codes: string[];
  states: string[];
  priority: number;
  is_active: boolean;
  forward_enabled: boolean;
  forward_count: number;
  notes: string | null;
  zip_count?: number;
  product_count?: number;
  created_at: string;
  updated_at?: string;
}

interface ForwardingRulesListProps {
  webhookId: string;
  rules: ForwardingRule[];
  onRefresh: () => void;
}

export function ForwardingRulesList({ webhookId, rules, onRefresh }: ForwardingRulesListProps) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ForwardingRule | null>(null);
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [loadingMasterToggle, setLoadingMasterToggle] = useState(false);
  const [fetchingMasterToggle, setFetchingMasterToggle] = useState(true);
  const { toast } = useToast();

  // Handle editing a rule
  const handleEditRule = (rule: ForwardingRule) => {
    setEditingRule(rule);
    setShowCreateDialog(true);
  };

  // Handle dialog close - reset editing state
  const handleDialogClose = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      setEditingRule(null);
    }
  };

  // Fetch master forwarding toggle status
  const fetchMasterToggle = async () => {
    try {
      setFetchingMasterToggle(true);
      const response = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}`
      );
      const data = await response.json();

      if (data.config) {
        // Check if forwarding_enabled exists in the response
        const enabled = data.config.forwarding_enabled === 1 || data.config.forwarding_enabled === true;
        setForwardingEnabled(enabled);
      }
    } catch (error) {
      console.error('Error fetching master toggle:', error);
    } finally {
      setFetchingMasterToggle(false);
    }
  };

  // Toggle master forwarding switch
  const handleMasterToggle = async (checked: boolean) => {
    try {
      setLoadingMasterToggle(true);
      const response = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-toggle`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forwarding_enabled: checked }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setForwardingEnabled(checked);
        toast({
          title: "Success",
          description: `Lead forwarding ${checked ? 'enabled' : 'disabled'} for this webhook`,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update forwarding status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling master forwarding:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setLoadingMasterToggle(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      setDeleting(ruleId);
      const response = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-rules/${ruleId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Forwarding rule deleted successfully",
        });
        onRefresh();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete forwarding rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting forwarding rule:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleEnabled = async (rule: ForwardingRule) => {
    try {
      const response = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-rules/${rule.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forward_enabled: !rule.forward_enabled }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Forwarding rule ${!rule.forward_enabled ? 'enabled' : 'disabled'} successfully`,
        });
        onRefresh();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update forwarding rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating forwarding rule:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    }
  };

  // Fetch master toggle status on component mount
  useEffect(() => {
    fetchMasterToggle();
  }, [webhookId]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      relative: formatDistanceToNow(date, { addSuffix: true })
    };
  };

  // Group rules by target webhook
  const rulesByTarget = rules.reduce((acc, rule) => {
    if (!acc[rule.target_webhook_id]) {
      acc[rule.target_webhook_id] = {
        target_webhook_url: rule.target_webhook_url,
        rules: []
      };
    }
    acc[rule.target_webhook_id].rules.push(rule);
    return acc;
  }, {} as Record<string, { target_webhook_url: string; rules: ForwardingRule[] }>);

  const activeRulesCount = rules.filter(rule => rule.is_active && rule.forward_enabled).length;
  const totalZipCodes = rules.reduce((sum, rule) => sum + (rule.zip_count || rule.zip_codes.length), 0);
  const totalProductTypes = new Set(rules.flatMap(rule => rule.product_types)).size;

  return (
    <div className="space-y-6">
      {/* Master Forwarding Toggle - Critical Control */}
      <Alert className={forwardingEnabled
        ? "border-green-500/30 bg-green-950/20 dark:border-green-500/40 dark:bg-green-950/30"
        : "border-amber-500/30 bg-amber-950/20 dark:border-amber-500/40 dark:bg-amber-950/30"
      }>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Power className={`h-4 w-4 flex-shrink-0 ${forwardingEnabled ? 'text-green-500' : 'text-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <AlertTitle className="mb-0.5 text-sm font-semibold">
                {forwardingEnabled ? (
                  <span className="text-green-500">Lead forwarding is ENABLED</span>
                ) : (
                  <span className="text-amber-500">Lead forwarding is DISABLED</span>
                )}
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {forwardingEnabled
                  ? "Leads matching your rules will be automatically forwarded to target webhooks"
                  : "Configure rules below, then enable forwarding to start automatic lead distribution"
                }
              </AlertDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {!forwardingEnabled && rules.length > 0 && (
              <div className="flex items-center gap-1.5 text-amber-500 bg-amber-950/30 px-2 py-1 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Rules inactive</span>
              </div>
            )}
            <Switch
              id="master-toggle"
              checked={forwardingEnabled}
              onCheckedChange={handleMasterToggle}
              disabled={loadingMasterToggle || fetchingMasterToggle}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Share2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{activeRulesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Zip Codes</p>
                <p className="text-2xl font-bold">{totalZipCodes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Product Types</p>
                <p className="text-2xl font-bold">{totalProductTypes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Lead Forwarding Rules</CardTitle>
              <CardDescription>
                Configure automatic forwarding criteria for incoming leads
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-12">
              <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No forwarding rules configured</h3>
              <p className="text-muted-foreground mb-4">
                Create forwarding rules to automatically send leads to other webhooks
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(rulesByTarget).map(([targetWebhookId, target]) => (
                <div key={targetWebhookId} className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{targetWebhookId}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{target.target_webhook_url}</p>
                    </div>
                    <Badge variant="outline">
                      {target.rules.length} rule{target.rules.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Priority</TableHead>
                          <TableHead>Product Types</TableHead>
                          <TableHead>Zip Codes</TableHead>
                          <TableHead>States</TableHead>
                          <TableHead>Hits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {target.rules
                          .sort((a, b) => a.priority - b.priority)
                          .map((rule) => {
                            const createdDate = formatDateTime(rule.created_at);
                            return (
                              <TableRow key={rule.id}>
                                <TableCell>
                                  <Badge variant="secondary">
                                    #{rule.priority}
                                  </Badge>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {rule.product_types.slice(0, 3).map((type, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {type}
                                        </Badge>
                                      ))}
                                      {rule.product_types.length > 3 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{rule.product_types.length - 3} more
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {rule.product_count || rule.product_types.length} product{(rule.product_count || rule.product_types.length) !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {rule.zip_codes.slice(0, 4).map((zip, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs font-mono">
                                          {zip}
                                        </Badge>
                                      ))}
                                      {rule.zip_codes.length > 4 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{rule.zip_codes.length - 4} more
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {rule.zip_count || rule.zip_codes.length} zip code{(rule.zip_count || rule.zip_codes.length) !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {rule.states?.slice(0, 5).map((state, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs font-mono">
                                          {state}
                                        </Badge>
                                      ))}
                                      {rule.states && rule.states.length > 5 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{rule.states.length - 5} more
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {rule.states?.length || 0} state{(rule.states?.length || 0) !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={rule.forward_count > 0 ? "default" : "secondary"}
                                      className={rule.forward_count > 0 ? "bg-blue-600 hover:bg-blue-700" : ""}
                                    >
                                      <Target className="h-3 w-3 mr-1" />
                                      {rule.forward_count}
                                    </Badge>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {rule.is_active && rule.forward_enabled ? (
                                      <Badge className="bg-green-100 text-green-800">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Active
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-gray-100 text-gray-800">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Inactive
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="space-y-1">
                                    <p className="text-sm">{createdDate.date}</p>
                                    <p className="text-xs text-muted-foreground">{createdDate.relative}</p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem
                                        onClick={() => handleToggleEnabled(rule)}
                                      >
                                        {rule.forward_enabled ? (
                                          <>
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Disable Rule
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Enable Rule
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Rule
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem
                                            className="text-red-600"
                                            onSelect={(e) => e.preventDefault()}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Rule
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Forwarding Rule</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete this forwarding rule? This action cannot be undone.
                                              Leads will no longer be forwarded to this webhook based on these criteria.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteRule(rule.id)}
                                              disabled={deleting === rule.id}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              {deleting === rule.id ? 'Deleting...' : 'Delete Rule'}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateForwardingRuleDialog
        webhookId={webhookId}
        open={showCreateDialog}
        onOpenChange={handleDialogClose}
        onSuccess={onRefresh}
        editRule={editingRule}
      />
    </div>
  );
}

