import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/dashboard/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  ArrowLeft,
  Edit,
  MoreHorizontal,
  Building,
  FileText,
  Clock,
  Activity,
  Star,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  position?: string;
  webhook_id: string;
  created_at: string;
  updated_at: string;
  leads?: Lead[];
  totalValue?: number;
  leadCount?: number;
}

interface Lead {
  id: number;
  contact_id: number;
  webhook_id: string;
  lead_type: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  source: string;
  status: string;
  revenue_potential?: number;
  created_at: string;
  updated_at: string;
}

const ContactDetail = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const API_BASE = 'https://api.homeprojectpartners.com';

  // Safe date formatting helper
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (contactId) {
      fetchContactData();
    }
  }, [contactId]);

  const fetchContactData = async () => {
    if (!contactId) return;

    try {
      setIsLoading(true);
      
      // Fetch contact leads to build contact info
      const leadsResponse = await fetch(`${API_BASE}/leads?contact_id=${contactId}`);
      
      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        const contactLeads = leadsData.leads || [];
        setLeads(contactLeads);

        if (contactLeads.length > 0) {
          // Use first lead to construct contact info
          const firstLead = contactLeads[0];
          const totalValue = contactLeads.reduce((sum: number, lead: Lead) => sum + (lead.revenue_potential || 0), 0);
          
          const contactInfo: Contact = {
            id: parseInt(contactId),
            first_name: firstLead.first_name,
            last_name: firstLead.last_name,
            email: firstLead.email,
            phone: firstLead.phone || '',
            company: 'Unknown Company', // Could be enhanced
            position: 'Customer',
            webhook_id: firstLead.webhook_id,
            created_at: firstLead.created_at,
            updated_at: firstLead.updated_at,
            leads: contactLeads,
            totalValue,
            leadCount: contactLeads.length
          };
          
          setContact(contactInfo);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contact data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'new': 'bg-blue-500',
      'contacted': 'bg-yellow-500',
      'qualified': 'bg-purple-500',
      'proposal': 'bg-orange-500',
      'negotiation': 'bg-indigo-500',
      'closed-won': 'bg-green-500',
      'closed-lost': 'bg-red-500',
    };

    return (
      <Badge 
        variant="secondary" 
        className={cn("text-white border-0", statusColors[status] || 'bg-gray-500')}
      >
        {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 rounded w-1/4"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!contact) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Contact Not Found</h2>
            <p className="text-muted-foreground mt-2">The contact you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/leads')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Contacts
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Navigation */}
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Contact Detail</span>
        </div>

        {/* Contact Header */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg font-semibold">
                    {contact.first_name[0]}{contact.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold">
                    {contact.first_name} {contact.last_name}
                  </h1>
                  <div className="flex items-center space-x-4 text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4" />
                      <span>{contact.company}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>{contact.position}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{contact.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{contact.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="outline">
                  <Star className="h-4 w-4 mr-2" />
                  Follow
                </Button>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{contact.leadCount}</div>
                <div className="text-sm text-muted-foreground">Total Leads</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(contact.totalValue || 0)}</div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {leads.filter(lead => lead.status === 'new').length}
                </div>
                <div className="text-sm text-muted-foreground">New Leads</div>
              </div>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {leads.filter(lead => lead.status === 'qualified').length}
                </div>
                <div className="text-sm text-muted-foreground">Qualified</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Leads ({contact.leadCount})</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p>{contact.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phone</label>
                        <p>{contact.phone}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company</label>
                        <p>{contact.company}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Position</label>
                        <p>{contact.position}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Webhook</label>
                        <Badge variant="outline">{contact.webhook_id}</Badge>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Created</label>
                        <p>{formatDate(contact.created_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Lead Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {leads.slice(0, 3).map((lead) => (
                        <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">Lead #{lead.id}</div>
                            <div className="text-sm text-muted-foreground">{lead.source}</div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(lead.status)}
                            <div className="text-sm font-medium mt-1">
                              {formatCurrency(lead.revenue_potential || 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Lead
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Phone className="h-4 w-4 mr-2" />
                      Log Call
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Meeting
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="text-sm">
                          <p className="font-medium">Lead created</p>
                          <p className="text-muted-foreground">2 hours ago</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div className="text-sm">
                          <p className="font-medium">Contact updated</p>
                          <p className="text-muted-foreground">1 day ago</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">All Leads for this Contact</h3>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Lead
              </Button>
            </div>
            
            <div className="grid gap-4">
              {leads.map((lead) => (
                <Card key={lead.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-semibold text-blue-600">Lead #{lead.id}</h4>
                          <p className="text-sm text-muted-foreground">{lead.source}</p>
                        </div>
                        {getStatusBadge(lead.status)}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">
                          {formatCurrency(lead.revenue_potential || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-medium">{lead.lead_type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Webhook:</span>
                        <p className="font-medium">{lead.webhook_id}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{lead.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium">{lead.phone || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No activities recorded yet</p>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No history available</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ContactDetail;
