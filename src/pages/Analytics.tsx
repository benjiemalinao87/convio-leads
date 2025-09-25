import { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Calendar,
  DollarSign,
  Users,
  Target,
  Clock,
  Zap,
  Activity,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from 'lucide-react';
import { mockAnalytics, mockWorkspaces } from '@/data/mockData';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(215, 20%, 65%)'];

// Types for Conversion Analytics
interface ConversionAnalytics {
  summary: {
    total_conversions: number;
    total_value: number;
    average_value: number;
    unique_contacts: number;
    active_workspaces: number;
    conversion_rate: string;
  };
  by_type: Array<{
    conversion_type: string;
    count: number;
    total_value: number;
    avg_value: number;
  }>;
  by_workspace: Array<{
    workspace_id: string;
    workspace_name: string;
    conversions: number;
    total_value: number;
    avg_value: number;
    unique_contacts: number;
  }>;
  trends: Array<{
    period: string;
    conversions: number;
    total_value: number;
  }>;
}

interface ConversionFunnel {
  stages: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  conversion_rate: number;
}

interface Conversion {
  id: string;
  contact_id: number;
  first_name: string;
  last_name: string;
  workspace_name: string;
  conversion_type: string;
  conversion_value: number;
  converted_at: string;
  converted_by: string;
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedWorkspace, setSelectedWorkspace] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Conversion tracking state
  const [conversionAnalytics, setConversionAnalytics] = useState<ConversionAnalytics | null>(null);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel | null>(null);
  const [recentConversions, setRecentConversions] = useState<Conversion[]>([]);
  const [isLoadingConversions, setIsLoadingConversions] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const API_BASE = 'https://api.homeprojectpartners.com';
  const analytics = mockAnalytics;

  // Load conversion data
  useEffect(() => {
    if (activeTab === 'conversions') {
      fetchConversionData();
    }
  }, [activeTab, timeRange, selectedWorkspace, refreshKey]);

  const fetchConversionData = async () => {
    setIsLoadingConversions(true);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(timeRange.replace('d', '')));

    const params = new URLSearchParams({
      from_date: fromDate.toISOString(),
      to_date: new Date().toISOString(),
      ...(selectedWorkspace !== 'all' && { workspace_id: selectedWorkspace })
    });

    try {
      const [analyticsRes, funnelRes, conversionsRes] = await Promise.all([
        fetch(`${API_BASE}/conversions/analytics?${params}`),
        fetch(`${API_BASE}/conversions/funnel?${params}`),
        fetch(`${API_BASE}/conversions?${params}&limit=10`)
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setConversionAnalytics(data.analytics);
      }

      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setConversionFunnel(data.funnel);
      }

      if (conversionsRes.ok) {
        const data = await conversionsRes.json();
        setRecentConversions(data.conversions || []);
      }
    } catch (error) {
      console.error('Error fetching conversion data:', error);
    } finally {
      setIsLoadingConversions(false);
    }
  };

  // Extended mock data for analytics
  const conversionFunnelData = [
    { stage: 'Leads', count: 2782, percentage: 100 },
    { stage: 'Qualified', count: 1946, percentage: 70 },
    { stage: 'Contacted', count: 1112, percentage: 40 },
    { stage: 'Appointments', count: 342, percentage: 12.3 },
    { stage: 'Closed', count: 156, percentage: 5.6 }
  ];

  const hourlyData = [
    { hour: '6AM', leads: 12, appointments: 1 },
    { hour: '8AM', leads: 24, appointments: 3 },
    { hour: '10AM', leads: 45, appointments: 6 },
    { hour: '12PM', leads: 67, appointments: 9 },
    { hour: '2PM', leads: 58, appointments: 8 },
    { hour: '4PM', leads: 52, appointments: 7 },
    { hour: '6PM', leads: 38, appointments: 5 },
    { hour: '8PM', leads: 28, appointments: 3 },
    { hour: '10PM', leads: 15, appointments: 2 }
  ];

  const revenueData = analytics.leads_over_time.map(day => ({
    ...day,
    revenue: day.appointments * 850 + Math.random() * 200
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getConversionTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-500';
      case 'appointment': return 'bg-blue-500';
      case 'qualified': return 'bg-yellow-500';
      case 'proposal': return 'bg-purple-500';
      case 'contract': return 'bg-indigo-500';
      default: return 'bg-gray-500';
    }
  };

  const getConversionTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return '💰';
      case 'appointment': return '📅';
      case 'qualified': return '✅';
      case 'proposal': return '📄';
      case 'contract': return '📝';
      default: return '📌';
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Deep insights into lead performance and conversion patterns
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Workspaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                <SelectItem value="workspace_1">Sales Team A</SelectItem>
                <SelectItem value="workspace_2">Sales Team B</SelectItem>
              </SelectContent>
            </Select>

            {activeTab === 'conversions' && (
              <Button
                onClick={() => setRefreshKey(k => k + 1)}
                variant="outline"
                size="sm"
                disabled={isLoadingConversions}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingConversions && "animate-spin")} />
                Refresh
              </Button>
            )}

            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="conversions" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    +{analytics.growth_rate}%
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{analytics.total_leads.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </div>
              </Card>

              <Card className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Target className="h-5 w-5 text-success" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{analytics.total_appointments.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Appointments</p>
                </div>
              </Card>

              <Card className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-accent" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{analytics.conversion_rate}%</p>
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                </div>
              </Card>

              <Card className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{analytics.avg_response_time}h</p>
                  <p className="text-xs text-muted-foreground">Avg Response</p>
                </div>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lead Trends */}
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Lead Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.leads_over_time}>
                    <defs>
                      <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="appointmentsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 25%)" />
                    <XAxis dataKey="date" stroke="hsl(215, 20%, 65%)" />
                    <YAxis stroke="hsl(215, 20%, 65%)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="leads" stackId="1" stroke="hsl(217, 91%, 60%)"
                          fill="url(#leadsGradient)" name="Leads" />
                    <Area type="monotone" dataKey="appointments" stackId="2" stroke="hsl(142, 76%, 36%)"
                          fill="url(#appointmentsGradient)" name="Appointments" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Source Distribution */}
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Lead Sources</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.leads_by_source}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.leads_by_source.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversion Funnel */}
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
                <div className="space-y-4">
                  {conversionFunnelData.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stage.stage}</span>
                        <span className="text-muted-foreground">{stage.count} ({stage.percentage}%)</span>
                      </div>
                      <Progress
                        value={stage.percentage}
                        className="h-2"
                        style={{
                          '--progress-background': index === 0 ? 'rgb(59, 130, 246)' :
                                                  index === 1 ? 'rgb(168, 85, 247)' :
                                                  index === 2 ? 'rgb(251, 191, 36)' :
                                                  index === 3 ? 'rgb(34, 197, 94)' :
                                                  'rgb(239, 68, 68)'
                        } as React.CSSProperties}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Hourly Activity */}
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Hourly Activity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 25%)" />
                    <XAxis dataKey="hour" stroke="hsl(215, 20%, 65%)" />
                    <YAxis stroke="hsl(215, 20%, 65%)" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="leads" fill="hsl(217, 91%, 60%)" name="Leads" />
                    <Bar dataKey="appointments" fill="hsl(142, 76%, 36%)" name="Appointments" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions" className="space-y-8">
            {isLoadingConversions && !conversionAnalytics ? (
              <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        +{conversionAnalytics?.summary.conversion_rate || 0}%
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{conversionAnalytics?.summary.total_conversions || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Conversions</p>
                    </div>
                  </Card>

                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-success" />
                      </div>
                      {conversionAnalytics && conversionAnalytics.summary.total_value > 0 && (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {formatCurrency(conversionAnalytics?.summary.total_value || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                    </div>
                  </Card>

                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-accent" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">
                        {formatCurrency(conversionAnalytics?.summary.average_value || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg. Deal Size</p>
                    </div>
                  </Card>

                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Users className="h-5 w-5 text-blue-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{conversionAnalytics?.summary.unique_contacts || 0}</p>
                      <p className="text-xs text-muted-foreground">Unique Contacts</p>
                    </div>
                  </Card>

                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Activity className="h-5 w-5 text-purple-500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{conversionAnalytics?.summary.active_workspaces || 0}</p>
                      <p className="text-xs text-muted-foreground">Active Teams</p>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Conversion Funnel */}
                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Conversion Funnel</h3>
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="space-y-4">
                      {conversionFunnel?.stages.map((stage, index) => (
                        <div key={stage.name} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stage.name}</span>
                            <span className="text-muted-foreground">
                              {stage.count} ({stage.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <Progress
                            value={stage.percentage}
                            className="h-2"
                            style={{
                              '--progress-background': index === 0 ? 'rgb(59, 130, 246)' :
                                                      index === 1 ? 'rgb(168, 85, 247)' :
                                                      index === 2 ? 'rgb(251, 191, 36)' :
                                                      'rgb(34, 197, 94)'
                            } as React.CSSProperties}
                          />
                        </div>
                      )) || (
                        <div className="text-center text-muted-foreground py-8">
                          <p className="text-sm">No funnel data available</p>
                          <p className="text-xs mt-2">Conversions will appear here as they are logged</p>
                        </div>
                      )}
                    </div>

                    {conversionFunnel && (
                      <div className="mt-6 pt-6 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Overall Conversion Rate</span>
                          <span className="text-2xl font-bold text-primary">
                            {conversionFunnel.conversion_rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Conversion by Type */}
                  <Card className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">By Type</h3>
                      <Filter className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="space-y-3">
                      {conversionAnalytics?.by_type.map(type => (
                        <div key={type.conversion_type} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", getConversionTypeColor(type.conversion_type))} />
                            <div>
                              <p className="font-medium capitalize">{type.conversion_type}</p>
                              <p className="text-xs text-muted-foreground">{type.count} conversions</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(type.total_value)}</p>
                            <p className="text-xs text-muted-foreground">
                              avg: {formatCurrency(type.avg_value)}
                            </p>
                          </div>
                        </div>
                      )) || (
                        <div className="text-center text-muted-foreground py-8">
                          <p className="text-sm">No conversion type data available</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Workspace Performance Table */}
                <Card className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Workspace Performance</h3>
                    <Badge variant="outline">{conversionAnalytics?.by_workspace.length || 0} Active</Badge>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Workspace</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Conversions</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg. Deal</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Contacts</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionAnalytics?.by_workspace.map(workspace => (
                          <tr key={workspace.workspace_id} className="border-b hover:bg-secondary/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium">{workspace.workspace_name}</div>
                              <div className="text-xs text-muted-foreground">{workspace.workspace_id}</div>
                            </td>
                            <td className="text-right py-3 px-4 font-medium">{workspace.conversions}</td>
                            <td className="text-right py-3 px-4 font-medium">
                              {formatCurrency(workspace.total_value)}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {formatCurrency(workspace.avg_value)}
                            </td>
                            <td className="text-right py-3 px-4 text-muted-foreground">
                              {workspace.unique_contacts}
                            </td>
                            <td className="text-right py-3 px-4">
                              {workspace.conversions > 0 && (
                                <Badge variant={workspace.conversions > 10 ? "default" : "secondary"}>
                                  {workspace.conversions > 10 ? "High" : "Normal"}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                              No workspace data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Recent Conversions Feed */}
                <Card className="glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Recent Conversions</h3>
                    <Badge className="animate-pulse" variant="default">Live</Badge>
                  </div>

                  <div className="space-y-3">
                    {recentConversions.map(conversion => (
                      <div key={conversion.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="text-2xl">{getConversionTypeIcon(conversion.conversion_type)}</div>
                          <div>
                            <p className="font-medium">
                              {conversion.first_name} {conversion.last_name}
                              <span className="ml-2 text-sm text-muted-foreground">
                                converted to {conversion.conversion_type}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conversion.converted_at).toLocaleString()} by {conversion.converted_by}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(conversion.conversion_value)}</p>
                          <p className="text-xs text-muted-foreground">{conversion.workspace_name}</p>
                        </div>
                      </div>
                    ))}

                    {recentConversions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No recent conversions</p>
                        <p className="text-xs mt-2">Conversions will appear here as they are logged</p>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}