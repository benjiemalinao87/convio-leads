import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Route,
  Building,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AppointmentHistoryItem {
  id: number;
  customer_name: string;
  service_type: string;
  customer_zip: string;
  matched_workspace_id: string;
  routing_method: string;
  forwarded_at: string | null;
  forward_status: string;
  forward_response: string | null;
  forward_response_parsed: any;
  forward_attempts: number;
  created_at: string;
  workspace_name: string;
  outbound_webhook_url: string;
  routing_status: string;
  webhook_url_masked: string | null;
}

interface AppointmentHistoryProps {
  onRefresh: () => void;
}

export function AppointmentHistory({ onRefresh }: AppointmentHistoryProps) {
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.homeprojectpartners.com/appointments/history');
      const data = await response.json();

      if (data.success) {
        setHistory(data.appointments || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load appointment history",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching appointment history:', error);
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
    fetchHistory();
  }, []);

  const handleRetryForwarding = async (appointmentId: number, workspaceId: string) => {
    try {
      setRetrying(appointmentId);
      const response = await fetch(`https://api.homeprojectpartners.com/appointments/${appointmentId}/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Appointment forwarded successfully",
        });
        fetchHistory(); // Refresh the history
        onRefresh(); // Refresh parent data
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to forward appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error retrying forwarding:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setRetrying(null);
    }
  };

  const getRoutingStatusBadge = (item: AppointmentHistoryItem) => {
    if (item.routing_status === 'unrouted') {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Unrouted
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-800">
        <Route className="h-3 w-3 mr-1" />
        Routed
      </Badge>
    );
  };

  const getForwardingStatusBadge = (item: AppointmentHistoryItem) => {
    switch (item.forward_status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    // Handle null, undefined, or empty strings
    if (!dateString) {
      return 'Not available';
    }

    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getWebhookResponse = (item: AppointmentHistoryItem) => {
    if (!item.forward_response_parsed) return 'No response';

    if (item.forward_response_parsed.request_id) {
      return `Success (${item.forward_response_parsed.request_id})`;
    }

    return item.forward_response_parsed.message || 'Unknown response';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading appointment history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Appointment Routing & Forwarding History
          </CardTitle>
          <CardDescription>
            Track the routing and webhook forwarding status of all received appointments
          </CardDescription>
          <div className="flex gap-2">
            <Button onClick={fetchHistory} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* History Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Forwarding</TableHead>
                  <TableHead>Webhook Response</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{item.customer_name}</div>
                          <div className="text-xs text-muted-foreground">ID: {item.id}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {item.service_type}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{item.customer_zip}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        {getRoutingStatusBadge(item)}
                        <div className="text-xs text-muted-foreground">
                          {item.routing_method === 'auto' ? 'Automatic' : 'Manual'}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {item.workspace_name ? (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{item.workspace_name}</div>
                            {item.webhook_url_masked && (
                              <div className="text-xs text-muted-foreground">
                                {item.webhook_url_masked}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No workspace</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        {getForwardingStatusBadge(item)}
                        {item.forwarded_at && (
                          <div className="text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {formatDateTime(item.forwarded_at)}
                          </div>
                        )}
                        {item.forward_attempts > 1 && (
                          <div className="text-xs text-orange-600">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            {item.forward_attempts} attempts
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm max-w-[200px] truncate">
                        {getWebhookResponse(item)}
                      </div>
                      {item.forward_response_parsed?.request_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <ExternalLink className="h-3 w-3 inline mr-1" />
                          Hookdeck ID
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </div>
                    </TableCell>

                    <TableCell>
                      {(item.forward_status === 'pending' || item.forward_status === 'failed') &&
                       item.matched_workspace_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryForwarding(item.id, item.matched_workspace_id)}
                          disabled={retrying === item.id}
                        >
                          {retrying === item.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {history.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-8 w-8 mr-2" />
              <span>No appointment history found</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}