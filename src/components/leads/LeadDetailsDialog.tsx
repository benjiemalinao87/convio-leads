import { useState, useEffect } from 'react';
import { Lead, leadStatuses } from '@/data/leadsData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  FileText,
  Edit,
  MessageSquare,
  Plus,
  RefreshCw,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadDetailsDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (lead: Lead) => void;
  onViewLead?: (lead: Lead) => void;
  isContactMode?: boolean;
}

// API interfaces
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

interface APIActivity {
  id: number;
  lead_id: number;
  activity_type: string;
  title: string;
  description?: string;
  activity_date: string;
  created_by?: string;
  created_by_name?: string;
  metadata?: string;
}

interface APIStatusHistory {
  id: number;
  lead_id: number;
  old_status: string;
  new_status: string;
  changed_by?: string;
  changed_by_name?: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

export function LeadDetailsDialog({ lead, open, onOpenChange, onEdit, onViewLead, isContactMode = false }: LeadDetailsDialogProps) {
  const [apiLead, setApiLead] = useState<APILead | null>(null);
  const [contactLeads, setContactLeads] = useState<APILead[]>([]);
  const [activities, setActivities] = useState<APIActivity[]>([]);
  const [statusHistory, setStatusHistory] = useState<APIStatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const API_BASE = 'https://api.homeprojectpartners.com'; // Always use production API

  // The lead ID from the frontend is already the API lead ID (converted to string in Leads.tsx)
  const getApiLeadId = (mockLead: Lead): number | null => {
    // Since the frontend already uses API IDs as strings, we can directly convert
    const apiId = parseInt(mockLead.id);
    if (isNaN(apiId)) {
      console.error('Invalid lead ID:', mockLead.id);
      return null;
    }
    return apiId;
  };

  useEffect(() => {
    if (open && lead) {
      fetchLeadData();
    }
  }, [open, lead]);

  const fetchLeadData = async () => {
    if (!lead) return;

    const apiLeadId = getApiLeadId(lead);
    if (!apiLeadId) {
      console.log('No API lead ID mapped for lead:', lead.id, 'Available IDs: 1, 2, 3');
      return;
    }

    setIsLoading(true);
    try {

      let requests = [
        fetch(`${API_BASE}/leads/${apiLeadId}`),
        fetch(`${API_BASE}/leads/${apiLeadId}/activities`),
        fetch(`${API_BASE}/leads/${apiLeadId}/history`)
      ];

      // If in contact mode and we have a contact_id, also fetch all leads for this contact
      if (isContactMode && lead.contact_id) {
        requests.push(fetch(`${API_BASE}/leads?contact_id=${lead.contact_id}`));
      }

      const responses = await Promise.all(requests);
      const [leadResponse, activitiesResponse, historyResponse, contactLeadsResponse] = responses;

      console.log('Lead response status:', leadResponse.status);

      if (leadResponse.ok) {
        const leadData = await leadResponse.json();
        console.log('Lead data received:', leadData);
        setApiLead(leadData.lead);
      } else {
        console.error('Lead response not OK:', await leadResponse.text());
      }

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setActivities(activitiesData.activities || []);
      } else {
        console.error('Activities response not OK:', await activitiesResponse.text());
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setStatusHistory(historyData.history || []);
      } else {
        console.error('History response not OK:', await historyResponse.text());
      }

      // Handle contact leads if in contact mode
      if (contactLeadsResponse && contactLeadsResponse.ok) {
        const contactLeadsData = await contactLeadsResponse.json();
        setContactLeads(contactLeadsData.leads || []);
      } else if (contactLeadsResponse) {
        console.error('Contact leads response not OK:', await contactLeadsResponse.text());
      }
    } catch (error) {
      console.error('Failed to fetch lead data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!lead) return null;

  const getStatusBadge = (status: Lead['status']) => {
    const statusConfig = leadStatuses.find(s => s.value === status);
    if (!statusConfig) return null;

    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "text-white border-0",
          statusConfig.color
        )}
      >
        {statusConfig.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Convert API lead to Lead format for onViewLead callback
  const convertAPILeadToLead = (apiLead: APILead): Lead => {
    return {
      id: apiLead.id.toString(),
      name: `${apiLead.first_name} ${apiLead.last_name}`,
      position: 'Customer', // Default position
      company: 'Unknown Company', // Could be enhanced to fetch from contact
      email: apiLead.email,
      phone: apiLead.phone || '',
      status: apiLead.status as Lead['status'],
      value: apiLead.revenue_potential || 0,
      source: apiLead.source,
      lastActivity: apiLead.updated_at,
      createdAt: apiLead.created_at,
      webhook: apiLead.webhook_id,
      assignedTo: apiLead.assigned_to || '',
      contact_id: apiLead.contact_id
    };
  };

  const handleSwitchToLead = (contactLead: APILead) => {
    if (onViewLead) {
      const convertedLead = convertAPILeadToLead(contactLead);
      onViewLead(convertedLead);
    }
  };

  // Use API activities or fallback to mock data
  const displayActivities = activities.length > 0 ? activities.map(activity => ({
    id: activity.id.toString(),
    type: activity.activity_type,
    title: activity.title,
    description: activity.description || '',
    timestamp: activity.activity_date,
    user: activity.created_by_name || activity.created_by || 'System'
  })) : [
    {
      id: '1',
      type: 'note',
      title: 'Initial Contact',
      description: 'Made initial contact via email. Lead showed interest in enterprise package.',
      timestamp: lead.createdAt,
      user: lead.assignedTo
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-3 w-3" />;
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'note':
        return <FileText className="h-3 w-3" />;
      case 'status_change':
        return <RefreshCw className="h-3 w-3" />;
      case 'assignment':
        return <User className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getActivityIconBg = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-500';
      case 'email':
        return 'bg-green-500';
      case 'note':
        return 'bg-gray-500';
      case 'status_change':
        return 'bg-purple-500';
      case 'assignment':
        return 'bg-orange-500';
      default:
        return 'bg-primary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-2xl">
                {lead.name}
                {isContactMode && contactLeads.length > 1 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (Contact with {contactLeads.length} leads)
                  </span>
                )}
              </DialogTitle>
              <button
                onClick={() => setShowStatusModal(true)}
                className="hover:opacity-80 transition-opacity"
              >
                {getStatusBadge((apiLead?.status || lead.status) as Lead['status'])}
              </button>
              {isLoading && (
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={fetchLeadData} disabled={isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => onEdit?.(lead)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Lead
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Leads (when in contact mode) - Show at top */}
            {isContactMode && contactLeads.length > 1 && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      <span>All Leads for this Contact</span>
                      <Badge variant="secondary" className="ml-2">
                        {contactLeads.length} leads
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contactLeads.length > 0 ? (
                    <div className="space-y-3">
                      {contactLeads.map((contactLead, index) => (
                      <div key={contactLead.id} className={cn(
                        "border rounded-lg p-3 space-y-2 transition-colors shadow-sm",
                        contactLead.id.toString() === lead.id 
                          ? "border-blue-500 bg-blue-100 shadow-blue-200" 
                          : "border-gray-400 bg-white hover:bg-gray-50 shadow-gray-200"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-blue-600">
                              Lead #{contactLead.id}
                              {contactLead.id.toString() === lead.id && (
                                <Badge variant="outline" className="ml-2 text-xs">Current</Badge>
                              )}
                            </span>
                            {getStatusBadge(contactLead.status as Lead['status'] || 'new')}
                          </div>
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold">{formatCurrency(contactLead.revenue_potential || 0)}</p>
                            {contactLead.id.toString() !== lead.id && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleSwitchToLead(contactLead)}
                                className="text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600 font-medium">Source:</span> 
                            <span className="ml-1 text-gray-900">{contactLead.source}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Webhook:</span> 
                            <span className="ml-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium">{contactLead.webhook_id}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Created:</span> 
                            <span className="ml-1 text-gray-900">{formatDateShort(contactLead.created_at)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 font-medium">Priority:</span> 
                            <span className="ml-1 text-gray-900">{contactLead.priority || 1}</span>
                          </div>
                        </div>
                        {contactLead.notes && (
                          <p className="text-sm text-muted-foreground bg-secondary/20 p-2 rounded">
                            {contactLead.notes}
                          </p>
                        )}
                      </div>
                    ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="border rounded-lg p-3 text-center">
                        {isLoading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Loading contact leads...</span>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Contact ID: {lead.contact_id}
                            </p>
                            <p className="text-sm">
                              Unable to load additional leads for this contact.
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={fetchLeadData}
                              className="mt-2"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{lead.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{lead.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Company</p>
                        <p className="font-medium">{lead.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium">{lead.position}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Lead Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Lead Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Deal Value</p>
                        <p className="font-medium text-lg">{formatCurrency(lead.value)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Source</p>
                        <p className="font-medium">{lead.source}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Webhook</p>
                        <p className="font-medium text-blue-600">{lead.webhook}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="font-medium">{formatDateShort(lead.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Activity</p>
                        <p className="font-medium">{formatDateShort(lead.lastActivity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {lead.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Notes</p>
                      <p className="text-sm bg-secondary/20 p-3 rounded-md">{lead.notes}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-secondary/20 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(apiLead?.revenue_potential || lead.value)}</p>
                  <p className="text-sm text-muted-foreground">Deal Value</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Contact ID:</span>
                    <span className="text-sm font-mono font-medium text-primary">
                      {isLoading ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Loading...
                        </span>
                      ) : apiLead?.contact_id ? (
                        `#${apiLead.contact_id}`
                      ) : lead.contact_id ? (
                        `#${lead.contact_id}`
                      ) : (
                        <span className="text-muted-foreground">#N/A</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Lead ID:</span>
                    <span className="text-sm font-mono font-medium text-blue-600">
                      {apiLead?.id ? (
                        `#${apiLead.id}`
                      ) : (
                        `#${lead.id}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Assigned to:</span>
                    <span className="text-sm font-medium">{apiLead?.assigned_to || lead.assignedTo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {getStatusBadge((apiLead?.status || lead.status) as Lead['status'])}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Source:</span>
                    <span className="text-sm font-medium">{apiLead?.source || lead.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Webhook:</span>
                    <span className="text-sm font-medium text-blue-600">{apiLead?.webhook_id || lead.webhook}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Recent Activity
                  <Button variant="outline" size="sm" onClick={() => setShowActivityModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {displayActivities.length > 0 ? displayActivities.map((activity, index) => (
                    <div key={activity.id} className="flex space-x-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-white",
                          getActivityIconBg(activity.type)
                        )}>
                          {getActivityIcon(activity.type)}
                        </div>
                        {index < displayActivities.length - 1 && (
                          <div className="w-px h-8 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(activity.timestamp)}
                          </p>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          by {activity.user}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-muted-foreground py-4">
                      <p className="text-sm">No activities recorded</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowActivityModal(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Activity
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status History */}
            {statusHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statusHistory.map((history) => (
                      <div key={history.id} className="border-l-2 border-primary pl-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">
                              {history.old_status ? `${history.old_status} → ` : ''}
                              <span className="text-primary">{history.new_status}</span>
                            </p>
                            {history.reason && (
                              <p className="text-xs text-muted-foreground mt-1">{history.reason}</p>
                            )}
                            {history.changed_by_name && (
                              <p className="text-xs text-muted-foreground">by {history.changed_by_name}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDateShort(history.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
