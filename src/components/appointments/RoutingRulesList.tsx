import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Building,
  MapPin,
  Package,
  RefreshCw,
  Route,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { CreateRoutingRuleDialog } from './CreateRoutingRuleDialog';

interface RoutingRule {
  id: number;
  workspace_id: string;
  workspace_name: string;
  product_types: string[];
  zip_codes: string[];
  priority: number;
  is_active: boolean;
  notes: string;
  zip_count: number;
  product_count: number;
  created_at: string;
}

interface RoutingRulesListProps {
  rules: RoutingRule[];
  onRefresh: () => void;
}

export function RoutingRulesList({ rules, onRefresh }: RoutingRulesListProps) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const handleDeleteRule = async (ruleId: number) => {
    try {
      setDeleting(ruleId);
      const response = await fetch(`https://api.homeprojectpartners.com/routing-rules/${ruleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Routing rule deleted successfully",
        });
        onRefresh();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete routing rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting routing rule:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (rule: RoutingRule) => {
    try {
      const response = await fetch(`https://api.homeprojectpartners.com/routing-rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !rule.is_active,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Routing rule ${!rule.is_active ? 'activated' : 'deactivated'} successfully`,
        });
        onRefresh();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update routing rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating routing rule:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      relative: formatDistanceToNow(date, { addSuffix: true })
    };
  };

  // Group rules by workspace
  const rulesByWorkspace = rules.reduce((acc, rule) => {
    if (!acc[rule.workspace_id]) {
      acc[rule.workspace_id] = {
        workspace_name: rule.workspace_name,
        rules: []
      };
    }
    acc[rule.workspace_id].rules.push(rule);
    return acc;
  }, {} as Record<string, { workspace_name: string; rules: RoutingRule[] }>);

  const activeRulesCount = rules.filter(rule => rule.is_active).length;
  const totalZipCodes = rules.reduce((sum, rule) => sum + rule.zip_count, 0);
  const totalProductTypes = new Set(rules.flatMap(rule => rule.product_types)).size;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Route className="h-5 w-5 text-blue-600" />
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
              <CardTitle>Routing Rules</CardTitle>
              <CardDescription>
                Configure automatic routing criteria for appointments
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
              <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No routing rules configured</h3>
              <p className="text-muted-foreground mb-4">
                Create routing rules to automatically assign appointments to workspaces
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(rulesByWorkspace).map(([workspaceId, workspace]) => (
                <div key={workspaceId} className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">{workspace.workspace_name}</h3>
                    <Badge variant="outline">
                      {workspace.rules.length} rule{workspace.rules.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Priority</TableHead>
                          <TableHead>Product Types</TableHead>
                          <TableHead>Zip Codes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workspace.rules
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
                                      {rule.product_count} product{rule.product_count !== 1 ? 's' : ''}
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
                                      {rule.zip_count} zip code{rule.zip_count !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {rule.is_active ? (
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
                                        onClick={() => handleToggleActive(rule)}
                                      >
                                        {rule.is_active ? (
                                          <>
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Deactivate Rule
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Activate Rule
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
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
                                            <AlertDialogTitle>Delete Routing Rule</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete this routing rule? This action cannot be undone.
                                              Appointments will no longer be routed to this workspace based on these criteria.
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

      <CreateRoutingRuleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={onRefresh}
      />
    </div>
  );
}