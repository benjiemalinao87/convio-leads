import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadsFiltersComponent, LeadsFilters } from '@/components/leads/LeadsFilters';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { Lead } from '@/data/leadsData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  UserPlus,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// API Lead interface that matches our D1 database
interface APILead {
  id: number;
  contact_id?: number;
  webhook_id: string;
  lead_type: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  priority?: number;
  notes?: string;
  revenue_potential?: number;
  follow_up_date?: string;
}

// Convert API lead to our existing Lead format
const convertAPILeadToLead = (apiLead: APILead): Lead => {
  const getWebhookDisplayName = (webhookId: string) => {
    const webhookMap: { [key: string]: string } = {
      'ws_cal_solar_001': 'Solar - California',
      'ws_tx_hvac_002': 'HVAC - Texas',
      'ws_fl_ins_003': 'Insurance - Florida',
    };
    return webhookMap[webhookId] || webhookId;
  };

  return {
    id: apiLead.id.toString(),
    contact_id: apiLead.contact_id,
    name: `${apiLead.first_name} ${apiLead.last_name}`,
    company: apiLead.lead_type.charAt(0).toUpperCase() + apiLead.lead_type.slice(1) + ' Services',
    email: apiLead.email,
    phone: apiLead.phone || '',
    position: 'Customer',
    source: apiLead.source,
    status: apiLead.status as Lead['status'],
    value: apiLead.revenue_potential || 0,
    assignedTo: apiLead.assigned_to || 'Unassigned',
    webhook: getWebhookDisplayName(apiLead.webhook_id),
    priority: apiLead.priority || 1,
    createdAt: apiLead.created_at,
    lastActivity: apiLead.updated_at,
    notes: apiLead.notes || '',
  };
};

const Leads = () => {
  const [filters, setFilters] = useState<LeadsFilters>({
    search: '',
    status: '',
    source: '',
    webhook: '',
    assignedTo: '',
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [apiLeads, setApiLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/leads?limit=1000`);

      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      const leads = data.leads || [];

      // Convert API leads to our Lead format
      const convertedLeads = leads.map((apiLead: APILead) => convertAPILeadToLead(apiLead));
      setApiLeads(convertedLeads);

    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leads');
    } finally {
      setIsLoading(false);
    }
  };

  // Use only API leads
  const leadsData = apiLeads;

  // Group leads by contact_id and filter
  const { filteredContacts, filteredLeads } = useMemo(() => {
    // First filter leads
    const filtered = leadsData.filter((lead) => {
      const matchesSearch = !filters.search ||
        lead.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.company.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.email.toLowerCase().includes(filters.search.toLowerCase());

      const matchesStatus = !filters.status || lead.status === filters.status;
      const matchesSource = !filters.source || lead.source === filters.source;
      const matchesWebhook = !filters.webhook || lead.webhook === filters.webhook;
      const matchesAssignedTo = !filters.assignedTo || lead.assignedTo === filters.assignedTo;

      return matchesSearch && matchesStatus && matchesSource && matchesWebhook && matchesAssignedTo;
    });

    // Group leads by contact_id (or phone if no contact_id)
    const contactsMap = new Map();

    filtered.forEach(lead => {
      const contactKey = lead.contact_id ? `contact_${lead.contact_id}` : `phone_${lead.phone}`;

      if (!contactsMap.has(contactKey)) {
        // Create a contact entry using the first lead's data
        contactsMap.set(contactKey, {
          ...lead,
          leads: [lead],
          leadCount: 1,
          totalValue: lead.value,
          latestActivity: lead.lastActivity,
          allStatuses: [lead.status]
        });
      } else {
        // Add lead to existing contact
        const contact = contactsMap.get(contactKey);
        contact.leads.push(lead);
        contact.leadCount++;
        contact.totalValue += lead.value;

        // Use most recent activity
        if (new Date(lead.lastActivity) > new Date(contact.latestActivity)) {
          contact.latestActivity = lead.lastActivity;
        }

        // Use most recent lead's email if newer
        if (new Date(lead.createdAt) > new Date(contact.createdAt)) {
          contact.email = lead.email;
        }

        // Track all statuses
        if (!contact.allStatuses.includes(lead.status)) {
          contact.allStatuses.push(lead.status);
        }

        // Use highest priority status as main status
        const statusPriority = { 'new': 1, 'contacted': 2, 'qualified': 3, 'proposal': 4, 'negotiation': 5, 'closed-won': 6, 'closed-lost': 0 };
        const currentPriority = statusPriority[contact.status] || 0;
        const newPriority = statusPriority[lead.status] || 0;
        if (newPriority > currentPriority) {
          contact.status = lead.status;
        }
      }
    });

    const contacts = Array.from(contactsMap.values());

    return {
      filteredContacts: contacts,
      filteredLeads: filtered
    };
  }, [filters, leadsData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalValue = filteredLeads.reduce((sum, lead) => sum + lead.value, 0);
    const wonDeals = filteredLeads.filter(lead => lead.status === 'closed-won');
    const lostDeals = filteredLeads.filter(lead => lead.status === 'closed-lost');
    const activeLeads = filteredLeads.filter(lead =>
      !['closed-won', 'closed-lost'].includes(lead.status)
    );

    const conversionRate = filteredLeads.length > 0
      ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100
      : 0;

    return {
      totalLeads: filteredLeads.length,
      totalContacts: filteredContacts.length,
      totalValue,
      activeLeads: activeLeads.length,
      conversionRate: isNaN(conversionRate) ? 0 : conversionRate,
      wonDeals: wonDeals.length,
      averageDealSize: filteredLeads.length > 0 ? totalValue / filteredLeads.length : 0,
    };
  }, [filteredLeads, filteredContacts]);

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailsDialogOpen(true);
  };

  const handleEditLead = (lead: Lead) => {
    console.log('Edit lead:', lead);
    // TODO: Implement lead edit functionality
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      // Find the contact this lead belongs to
      const leadToDelete = apiLeads.find(lead => lead.id === leadId);
      const contactId = leadToDelete?.contact_id;

      if (!contactId) {
        // If no contact_id, delete individual lead
        const response = await fetch(`${API_BASE}/leads/${leadId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete lead');
        }

        const result = await response.json();

        // Remove the deleted lead from the local state
        setApiLeads(prev => prev.filter(lead => lead.id !== leadId));

        console.log('Lead deleted successfully:', result.deleted_lead);
      } else {
        // Delete entire contact and all associated leads
        const response = await fetch(`${API_BASE}/leads/contact/${contactId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete contact');
        }

        const result = await response.json();

        // Remove all leads with this contact_id from the local state
        setApiLeads(prev => prev.filter(lead => lead.contact_id !== contactId));

        console.log('Contact deleted successfully:', result.deleted_contact);
      }

    } catch (error) {
      console.error('Failed to delete:', error);
      // Handle error (you can show an error toast here if needed)
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Leads Management</h1>
          <Button
            onClick={fetchLeads}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error: {error}</p>
              <Button onClick={fetchLeads} className="mt-2" size="sm">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacts & Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalContacts}</div>
              <p className="text-xs text-muted-foreground">
                {kpis.totalLeads} total leads
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(kpis.averageDealSize)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {kpis.wonDeals} deals won
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.activeLeads}</div>
              <p className="text-xs text-muted-foreground">
                In pipeline
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <LeadsFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              totalCount={leadsData.length}
              filteredCount={filteredLeads.length}
            />
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>All Contacts</span>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-sm">
                  {filteredContacts.length} contacts
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {filteredLeads.length} leads
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4 p-4">
                    <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <LeadsTable
                leads={filteredContacts}
                onViewLead={handleViewLead}
                onEditLead={handleEditLead}
                onDeleteLead={handleDeleteLead}
                isContactMode={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Lead Details Dialog */}
        <LeadDetailsDialog
          lead={selectedLead}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          onEdit={handleEditLead}
          isContactMode={true}
        />
      </div>
    </Layout>
  );
};

export default Leads;
