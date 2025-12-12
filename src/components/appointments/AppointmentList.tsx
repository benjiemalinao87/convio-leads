import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Building,
  MoreHorizontal,
  Send,
  Eye,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Appointment {
  id: number;
  lead_id: number;
  contact_id: number;
  appointment_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  service_type: string;
  customer_zip: string;
  estimated_value: number;
  matched_workspace_id: string | null;
  routing_method: string;
  workspace_name: string | null;
  forward_status: string;
  created_at: string;
}

interface AppointmentListProps {
  appointments: Appointment[];
  loading: boolean;
  onRefresh: () => void;
}

export function AppointmentList({ appointments, loading, onRefresh }: AppointmentListProps) {
  const [forwarding, setForwarding] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { toast } = useToast();

  const handleForwardAppointment = async (appointmentId: number) => {
    try {
      setForwarding(appointmentId);
      const response = await fetch(`https://api.homeprojectpartners.com/appointments/${appointmentId}/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Appointment forwarded successfully",
        });
        onRefresh(); // Refresh the list to show updated forward status
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to forward appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error forwarding appointment:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setForwarding(null);
    }
  };

  const handleDeleteAppointment = async (appointmentId: number, customerName: string) => {
    if (!confirm(`Are you sure you want to delete the appointment for "${customerName || 'this customer'}"?`)) {
      return;
    }

    try {
      setDeleting(appointmentId);
      const response = await fetch(`https://api.homeprojectpartners.com/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Appointment deleted successfully",
        });
        onRefresh(); // Refresh the list
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
      confirmed: { color: 'bg-green-100 text-green-800', label: 'Confirmed' },
      completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      no_show: { color: 'bg-yellow-100 text-yellow-800', label: 'No Show' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: 'bg-gray-100 text-gray-800',
      label: status
    };

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getForwardStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      success: { color: 'bg-green-100 text-green-800', label: 'Forwarded' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: 'bg-gray-100 text-gray-800',
      label: status
    };

    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    // Handle null, undefined, or empty strings
    if (!dateString) {
      return {
        date: 'Not scheduled',
        time: '-',
        relative: 'No date'
      };
    }

    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return {
        date: 'Invalid date',
        time: '-',
        relative: 'Invalid'
      };
    }

    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      relative: formatDistanceToNow(date, { addSuffix: true })
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading appointments...</span>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No appointments found</h3>
        <p className="text-muted-foreground mb-4">
          Appointments will appear here once received from third-party providers
        </p>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing {appointments.length} appointments
        </div>
        <Button onClick={onRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Forward Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment) => {
              const scheduledTime = formatDateTime(appointment.scheduled_at);
              return (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {appointment.customer_name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {appointment.customer_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {appointment.customer_zip}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">
                      {appointment.service_type}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {scheduledTime.date}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {scheduledTime.time}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(appointment.status)}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {appointment.workspace_name || appointment.matched_workspace_id || 'Unrouted'}
                        </span>
                      </div>
                      <Badge 
                        variant={appointment.matched_workspace_id ? "outline" : "secondary"} 
                        className="text-xs"
                      >
                        {appointment.routing_method || 'unrouted'}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    {getForwardStatusBadge(appointment.forward_status)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatCurrency(appointment.estimated_value)}
                      </span>
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
                          onClick={() => handleForwardAppointment(appointment.id)}
                          disabled={forwarding === appointment.id || !appointment.matched_workspace_id}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {forwarding === appointment.id 
                            ? 'Forwarding...' 
                            : !appointment.matched_workspace_id 
                            ? 'No Workspace (Cannot Forward)'
                            : 'Forward to Client'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Appointment
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => handleDeleteAppointment(appointment.id, appointment.customer_name)}
                          disabled={deleting === appointment.id}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleting === appointment.id ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
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
  );
}