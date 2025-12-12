import { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  Building,
  Route
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/hooks/use-toast';
import { AppointmentRoutingManager } from '@/components/appointments/AppointmentRoutingManager';
import { AppointmentList } from '@/components/appointments/AppointmentList';
import { RoutingRulesList } from '@/components/appointments/RoutingRulesList';
import { AppointmentHistory } from '@/components/appointments/AppointmentHistory';

// Type definitions for appointments
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

const Appointments = () => {
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.homeprojectpartners.com/appointments?limit=100');
      const data = await response.json();

      if (data.success) {
        setAppointments(data.appointments || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load appointments",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch routing rules
  const fetchRoutingRules = async () => {
    try {
      const response = await fetch('https://api.homeprojectpartners.com/routing-rules');
      const data = await response.json();

      if (data.success) {
        setRoutingRules(data.rules || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load routing rules",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching routing rules:', error);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchRoutingRules();
  }, []);

  // Filter appointments based on search and status
  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = searchTerm === '' ||
      (appointment.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (appointment.customer_phone || '').includes(searchTerm) ||
      (appointment.service_type?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (appointment.workspace_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-yellow-100 text-yellow-800',
    };

    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getForwardStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Appointment Routing</h1>
            <p className="text-muted-foreground">
              Manage appointments and routing rules for automatic assignment
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Appointments
            </TabsTrigger>
            <TabsTrigger value="routing" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Routing Rules
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="workspace" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Workspace
            </TabsTrigger>
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Appointments</CardTitle>
                    <CardDescription>
                      View and manage received appointments ({appointments.length} total)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search appointments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AppointmentList
                  appointments={filteredAppointments}
                  loading={loading}
                  onRefresh={fetchAppointments}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routing Rules Tab */}
          <TabsContent value="routing" className="space-y-6">
            <RoutingRulesList
              rules={routingRules}
              onRefresh={fetchRoutingRules}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <AppointmentHistory onRefresh={fetchAppointments} />
          </TabsContent>

          {/* Workspace Tab */}
          <TabsContent value="workspace" className="space-y-6">
            <AppointmentRoutingManager onRefresh={fetchRoutingRules} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Appointments;