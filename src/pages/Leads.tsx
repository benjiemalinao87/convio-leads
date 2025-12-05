import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/dashboard/Layout';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoadingSkeleton, TableSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { KPICard } from '@/components/dashboard/KPICard';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadsFiltersComponent, LeadsFilters } from '@/components/leads/LeadsFilters';
import { LeadDetailsDialog } from '@/components/leads/LeadDetailsDialog';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import { Lead } from '@/data/leadsData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
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
    createdAt: apiLead.created_at,
    lastActivity: apiLead.updated_at,
    notes: apiLead.notes || '',
  };
};

const Leads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProvider = user?.permission_type === 'provider';
  const providerId = user?.provider_id;
  
  const [filters, setFilters] = useState<LeadsFilters>({
    search: '',
    status: '',
    source: '',
    webhook: '',
    assignedTo: '',
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [apiLeads, setApiLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    fetchLeads();
  }, [providerId]); // Refetch when providerId changes

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build API URL with provider_id filter if user is a provider
      const params = new URLSearchParams({
        include: 'leads',
        limit: '1000',
        ...(isProvider && providerId && { provider_id: providerId })
      });

      // Fetch all contacts with their associated leads
      const response = await fetch(`${API_BASE}/contacts?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      let contacts = data.contacts || [];

      // For providers, filter out contacts that don't have any leads
      // (leads are already filtered by provider_id in the backend)
      if (isProvider) {
        contacts = contacts.filter((contact: any) => contact.leads && contact.leads.length > 0);
      }

      // Convert all leads from all contacts to our Lead format
      const allLeads: Lead[] = [];
      contacts.forEach((contact: any) => {
        if (contact.leads && contact.leads.length > 0) {
          // Convert each lead to our format, but use contact's phone
          contact.leads.forEach((apiLead: APILead) => {
            const convertedLead = convertAPILeadToLead(apiLead);
            // Override with contact's phone number (contacts are the primary entity)
            convertedLead.phone = contact.phone || convertedLead.phone;
            // Also use contact's name if lead doesn't have one
            if (!apiLead.first_name && !apiLead.last_name) {
              convertedLead.name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact';
            }
            allLeads.push(convertedLead);
          });
        } else if (!isProvider) {
          // Only create synthetic "lead" entries for contacts without leads for admin/dev users
          // Providers should only see contacts that have actual leads from their webhooks
          const contactAsLead: Lead = {
            id: `contact_${contact.id}`,
            contact_id: contact.id,
            name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown Contact',
            company: 'Contact Entry',
            email: contact.email || '',
            phone: contact.phone || '',
            position: 'Contact',
            source: 'Direct Contact',
            status: 'new' as Lead['status'],
            value: 0,
            assignedTo: 'Unassigned',
            webhook: contact.webhook_id || 'Unknown',
            createdAt: contact.created_at || new Date().toISOString(),
            lastActivity: contact.updated_at || contact.created_at || new Date().toISOString(),
            notes: '',
          };
          allLeads.push(contactAsLead);
        }
      });

      setApiLeads(allLeads);

    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
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

  const handleViewContactDetail = (contactId: string) => {
    navigate(`/contact/${contactId}`);
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditDialogOpen(true);
  };

  const handleSaveLead = (updatedLead: Lead) => {
    // Update the lead in the local state
    setApiLeads(prev => prev.map(lead =>
      lead.id === updatedLead.id ? updatedLead : lead
    ));

    // If this was the selected lead in details dialog, update it too
    if (selectedLead && selectedLead.id === updatedLead.id) {
      setSelectedLead(updatedLead);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      let response;
      let deleteType = 'lead';

      // Check if this is a contact entry (synthetic lead created for contacts without actual leads)
      if (leadId.startsWith('contact_')) {
        // Extract the actual contact ID and delete the contact
        const contactId = leadId.replace('contact_', '');
        deleteType = 'contact';
        response = await fetch(`${API_BASE}/contacts/${contactId}`, {
          method: 'DELETE',
        });
      } else {
        // This is a regular lead deletion
        response = await fetch(`${API_BASE}/leads/${leadId}`, {
          method: 'DELETE',
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete ${deleteType}: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();

      // Remove the deleted lead/contact from the local state
      setApiLeads(prev => prev.filter(lead => lead.id !== leadId));

      console.log(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully:`, result.deleted_lead || result.deleted_contact || result);

    } catch (error) {
      console.error('Failed to delete:', error);
      alert(`Error deleting: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      <div className="space-y-8">
        {/* Header with refresh button */}
        <PageHeader
          title="Leads Management"
          description={isProvider 
            ? "View and track your leads and contacts" 
            : "Manage and track all your leads and contacts"}
          actions={
            <Button
              onClick={fetchLeads}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          }
        />

        {/* Provider Filter Notice */}
        {isProvider && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Provider View:</strong> You are viewing only the leads from webhooks associated with your provider account ({providerId}).
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="pt-7">
              <p className="text-destructive">Error: {error}</p>
              <Button onClick={fetchLeads} className="mt-2" size="sm">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Contacts & Leads"
            value={kpis.totalContacts}
            subtitle={`${kpis.totalLeads} total leads`}
            icon={Users}
            iconColor="text-blue-600"
          />

          <KPICard
            title="Pipeline Value"
            value={formatCurrency(kpis.totalValue)}
            subtitle={`Avg: ${formatCurrency(kpis.averageDealSize)}`}
            icon={DollarSign}
            iconColor="text-green-600"
          />

          <KPICard
            title="Conversion Rate"
            value={`${kpis.conversionRate.toFixed(1)}%`}
            subtitle={`${kpis.wonDeals} deals won`}
            icon={Target}
            iconColor="text-emerald-600"
            trend={{ value: kpis.conversionRate, isPositive: kpis.conversionRate > 0 }}
          />

          <KPICard
            title="Active Deals"
            value={kpis.activeLeads}
            subtitle="In pipeline"
            icon={TrendingUp}
            iconColor="text-purple-600"
          />
        </div>

        {/* Filters */}
        <Card className="bg-card rounded-xl border border-border">
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
        <Card className="bg-card rounded-xl border border-border">
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
              <TableSkeleton />
            ) : filteredContacts.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No contacts found"
                description={
                  filters.search || filters.status || filters.source || filters.webhook || filters.assignedTo
                    ? "Try adjusting your filters to see more results"
                    : "Get started by creating your first contact or lead"
                }
              />
            ) : (
              <LeadsTable
                leads={filteredContacts}
                onViewLead={handleViewLead}
                onEditLead={handleEditLead}
                onDeleteLead={handleDeleteLead}
                onViewContactDetail={handleViewContactDetail}
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
          onViewLead={handleViewLead}
          isContactMode={true}
        />

        {/* Lead Edit Dialog */}
        <LeadEditDialog
          lead={selectedLead}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={handleSaveLead}
        />
      </div>
    </Layout>
  );
};

export default Leads;
