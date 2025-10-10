import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  FileJson,
  Activity,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ForwardingLogEntry {
  id: number;
  lead_id: number;
  contact_id: number;
  rule_id: number;
  source_webhook_id: string;
  target_webhook_id: string;
  target_webhook_url: string;
  forwarded_at: string;
  forward_status: 'success' | 'failed' | 'retry';
  http_status_code: number | null;
  response_body: string | null;
  error_message: string | null;
  retry_count: number;
  matched_product: string | null;
  matched_zip: string | null;
  payload: string;
}

interface ForwardingStats {
  total_forwards: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  last_forward_at: string | null;
}

interface ForwardingLogProps {
  webhookId: string;
}

export function ForwardingLog({ webhookId }: ForwardingLogProps) {
  const [logs, setLogs] = useState<ForwardingLogEntry[]>([]);
  const [stats, setStats] = useState<ForwardingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ForwardingLogEntry | null>(null);
  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);

      // Fetch logs
      const logsUrl = new URL(`https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-log`);
      if (statusFilter !== 'all') {
        logsUrl.searchParams.set('status', statusFilter);
      }
      logsUrl.searchParams.set('limit', '100');

      const logsResponse = await fetch(logsUrl.toString());
      const logsData = await logsResponse.json();

      if (logsData.success) {
        setLogs(logsData.logs || []);
      }

      // Fetch stats
      const statsResponse = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-stats`
      );
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error fetching forwarding logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch forwarding logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [webhookId, statusFilter]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: formatDistanceToNow(date, { addSuffix: true })
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'retry':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Retry
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getHttpStatusBadge = (code: number | null) => {
    if (!code) return <span className="text-muted-foreground">-</span>;

    const variant = code >= 200 && code < 300 ? 'default' : 'destructive';
    return <Badge variant={variant}>{code}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Forwards</p>
                  <p className="text-2xl font-bold">{stats.total_forwards}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold">{stats.success_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failed_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Forwarding Activity Log</CardTitle>
              <CardDescription>
                Track all lead forwarding attempts and their results
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="retry">Retry</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">Loading forwarding logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No forwarding activity yet</h3>
              <p className="text-muted-foreground">
                {statusFilter !== 'all'
                  ? `No logs found with status: ${statusFilter}`
                  : 'Forwarding logs will appear here once leads start matching your rules'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Criteria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP Code</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const forwardedDate = formatDateTime(log.forwarded_at);
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-mono">{forwardedDate.time}</p>
                            <p className="text-xs text-muted-foreground">{forwardedDate.relative}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="font-mono">
                              #{log.lead_id}
                            </Badge>
                            <p className="text-xs text-muted-foreground">Rule #{log.rule_id}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{log.target_webhook_id}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {log.target_webhook_url}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.matched_product && (
                              <Badge variant="outline" className="text-xs">
                                {log.matched_product}
                              </Badge>
                            )}
                            {log.matched_zip && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {log.matched_zip}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>{getStatusBadge(log.forward_status)}</TableCell>

                        <TableCell>{getHttpStatusBadge(log.http_status_code)}</TableCell>

                        <TableCell>
                          {log.retry_count > 0 ? (
                            <Badge variant="secondary">{log.retry_count}x</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                <FileJson className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Forwarding Details - Log #{log.id}</DialogTitle>
                                <DialogDescription>
                                  Detailed information about this forwarding attempt
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm font-semibold">Lead ID</p>
                                    <p className="text-sm text-muted-foreground">#{log.lead_id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Contact ID</p>
                                    <p className="text-sm text-muted-foreground">#{log.contact_id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Rule ID</p>
                                    <p className="text-sm text-muted-foreground">#{log.rule_id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Status</p>
                                    {getStatusBadge(log.forward_status)}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-semibold mb-1">Target Webhook</p>
                                  <div className="space-y-1">
                                    <p className="text-sm">{log.target_webhook_id}</p>
                                    <p className="text-xs text-muted-foreground font-mono break-all">
                                      {log.target_webhook_url}
                                    </p>
                                  </div>
                                </div>

                                {log.http_status_code && (
                                  <div>
                                    <p className="text-sm font-semibold mb-1">HTTP Response</p>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">Status Code:</span>
                                        {getHttpStatusBadge(log.http_status_code)}
                                      </div>
                                      {log.response_body && (
                                        <div>
                                          <p className="text-sm mb-1">Response Body:</p>
                                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                            {log.response_body}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {log.error_message && (
                                  <div>
                                    <p className="text-sm font-semibold mb-1">Error Message</p>
                                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-900">
                                      {log.error_message}
                                    </div>
                                  </div>
                                )}

                                <div>
                                  <p className="text-sm font-semibold mb-1">Original Payload</p>
                                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-64">
                                    {JSON.stringify(JSON.parse(log.payload), null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

