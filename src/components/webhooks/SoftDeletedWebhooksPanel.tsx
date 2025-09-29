import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DeletedWebhook {
  id: string;
  name: string;
  description: string;
  type: string;
  deletion: {
    deleted_at: string;
    deleted_by: string;
    reason: string;
    scheduled_deletion_at: string;
    job_id: string;
  };
  job_status: {
    status: string;
    attempts: number;
    execute_at: string;
    completed_at: string | null;
    error_message: string | null;
  };
  restoration: {
    can_restore: boolean;
    seconds_until_deletion: number;
    restore_endpoint: string | null;
  };
  stats: {
    total_leads: number;
  };
}

interface SoftDeletedWebhooksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onWebhookRestored?: () => void;
}

export default function SoftDeletedWebhooksPanel({
  isOpen,
  onClose,
  onWebhookRestored
}: SoftDeletedWebhooksPanelProps) {
  const [deletedWebhooks, setDeletedWebhooks] = useState<DeletedWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    if (isOpen) {
      fetchDeletedWebhooks();
    }
  }, [isOpen]);

  const fetchDeletedWebhooks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/webhook/deleted`);
      if (!response.ok) {
        throw new Error('Failed to fetch deleted webhooks');
      }

      const data = await response.json();
      setDeletedWebhooks(data.webhooks || []);
    } catch (err) {
      console.error('Failed to fetch deleted webhooks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deleted webhooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreWebhook = async (webhookId: string, webhookName: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE}/webhook/${webhookId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-user' // This should come from auth context
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to restore webhook');
      }

      toast({
        title: "Webhook Restored",
        description: `${webhookName} has been restored successfully.`,
      });

      // Refresh the deleted webhooks list
      await fetchDeletedWebhooks();

      // Notify parent component to refresh main webhook list
      onWebhookRestored?.();

    } catch (error) {
      console.error('Failed to restore webhook:', error);
      toast({
        title: "Restoration Failed",
        description: error instanceof Error ? error.message : 'Failed to restore webhook',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeRemainingProgress = (secondsRemaining: number): number => {
    if (secondsRemaining <= 0) return 0;
    const hoursRemaining = secondsRemaining / 3600;
    return Math.max(0, Math.min(100, (hoursRemaining / 24) * 100));
  };

  const formatTimeRemaining = (secondsRemaining: number): string => {
    if (secondsRemaining <= 0) return 'Expired';

    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    if (hours < 1) {
      if (minutes < 1) return 'Less than 1 minute';
      if (minutes === 1) return '1 minute remaining';
      return `${minutes} minutes remaining`;
    }
    if (hours === 1) return '1 hour remaining';
    return `${hours} hours remaining`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trash2 className="h-5 w-5 text-orange-500" />
                Deleted Webhooks
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage soft-deleted webhooks and restore them within 24 hours
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={fetchDeletedWebhooks}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Loading State */}
            {isLoading && deletedWebhooks.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading deleted webhooks...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-6">
                <Card className="bg-destructive/10 border-destructive">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <p>Error: {error}</p>
                    </div>
                    <Button onClick={fetchDeletedWebhooks} className="mt-3" size="sm">
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && deletedWebhooks.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold mb-2">No Deleted Webhooks</h3>
                  <p className="text-muted-foreground">
                    All webhooks are active. Deleted webhooks will appear here for 24 hours.
                  </p>
                </div>
              </div>
            )}

            {/* Deleted Webhooks List */}
            {deletedWebhooks.length > 0 && (
              <div className="divide-y divide-border">
                {deletedWebhooks.map((webhook) => (
                  <div key={webhook.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{webhook.name}</h3>
                          <Badge variant={
                            webhook.restoration.can_restore ? "default" : "destructive"
                          }>
                            {webhook.restoration.can_restore ? "Recoverable" : "Expired"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {webhook.type}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {webhook.description || 'No description'}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Deleted At</p>
                            <p className="font-medium">
                              {new Date(webhook.deletion.deleted_at).toLocaleDateString()} at{' '}
                              {new Date(webhook.deletion.deleted_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Deleted By</p>
                            <p className="font-medium">{webhook.deletion.deleted_by}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Reason</p>
                            <p className="font-medium">{webhook.deletion.reason}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Preserved Leads
                            </p>
                            <p className="font-medium">{webhook.stats.total_leads}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 ml-4">
                        {webhook.restoration.can_restore && (
                          <Button
                            onClick={() => handleRestoreWebhook(webhook.id, webhook.name)}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                        )}
                        {!webhook.restoration.can_restore && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">Cannot restore</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Time Remaining Progress */}
                    {webhook.restoration.can_restore && webhook.restoration.seconds_until_deletion > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span>Deletion scheduled for:</span>
                            <span className="font-medium">
                              {new Date(webhook.deletion.scheduled_deletion_at).toLocaleDateString()} at{' '}
                              {new Date(webhook.deletion.scheduled_deletion_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-orange-600">
                            {formatTimeRemaining(webhook.restoration.seconds_until_deletion)}
                          </span>
                        </div>
                        <Progress
                          value={getTimeRemainingProgress(webhook.restoration.seconds_until_deletion)}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Job Status */}
                    {webhook.job_status && webhook.job_status.status && webhook.job_status.status !== 'pending' && (
                      <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Deletion Job Status:</span>
                            <Badge variant={
                              webhook.job_status.status === 'completed' ? "default" :
                              webhook.job_status.status === 'failed' ? "destructive" :
                              webhook.job_status.status === 'cancelled' ? "secondary" : "outline"
                            }>
                              {webhook.job_status.status}
                            </Badge>
                          </div>
                          {webhook.job_status.attempts > 0 && (
                            <span className="text-sm text-muted-foreground">
                              Attempts: {webhook.job_status.attempts}
                            </span>
                          )}
                        </div>
                        {webhook.job_status.error_message && (
                          <p className="text-sm text-destructive mt-2">
                            Error: {webhook.job_status.error_message}
                          </p>
                        )}
                      </div>
                    )}

                    {webhook !== deletedWebhooks[deletedWebhooks.length - 1] && (
                      <Separator className="mt-6" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}