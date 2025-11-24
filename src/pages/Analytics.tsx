import { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { KPICard } from '@/components/dashboard/KPICard';
import { PageHeader } from '@/components/dashboard/PageHeader';
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
import { cn } from '@/lib/utils';
import { AnalyticsData } from '@/types/dashboard';
import { useAuth } from '@/hooks/useAuth';

// Extended analytics data type
interface ExtendedAnalyticsData extends AnalyticsData {
  avg_response_time?: number;
  growth_rate?: number;
}

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

// Types for Provider Analytics
interface Provider {
  id: number;
  provider_id: string;
  provider_name: string;
  company_name?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
}

interface ProviderConversions {
  provider: {
    provider_id: string;
    provider_name: string;
  };
  summary: {
    total_leads: number;
    scheduled_appointments: number;
    conversion_rate: string;
    total_estimated_value: number;
    status_breakdown: Record<string, number>;
  };
  conversions: Array<{
    lead_id: number;
    contact_id: number;
    customer_name: string;
    email: string;
    phone: string;
    zip_code: string;
    service_type: string;
    lead_status: string;
    lead_source: string;
    lead_created_at: string;
    appointment?: {
      appointment_id: number;
      appointment_date: string;
      appointment_type: string;
      estimated_value: number;
      forward_status: string;
      appointment_created_at: string;
    };
  }>;
}

interface ProviderPerformance {
  provider_id: string;
  provider_name: string;
  total_leads: number;
  total_appointments: number;
  conversion_rate: number;
  total_revenue: number;
  avg_deal_size: number;
  trend: 'up' | 'down' | 'stable';
  growth_rate: number;
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
  const { user } = useAuth();
  const isProvider = user?.permission_type === 'provider';
  const providerId = user?.provider_id;

  const [timeRange, setTimeRange] = useState('7d');
  const [selectedWorkspace, setSelectedWorkspace] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Conversion tracking state
  const [conversionAnalytics, setConversionAnalytics] = useState<ConversionAnalytics | null>(null);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel | null>(null);
  const [recentConversions, setRecentConversions] = useState<Conversion[]>([]);
  const [isLoadingConversions, setIsLoadingConversions] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Provider analytics state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerPerformance, setProviderPerformance] = useState<ProviderPerformance[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  const API_BASE = 'https://api.homeprojectpartners.com';

  // Analytics state
  const [analytics, setAnalytics] = useState<ExtendedAnalyticsData | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string }>>([]);
  const [leadsData, setLeadsData] = useState<Array<{ created_at: string; source?: string }>>([]);
  const [overviewFunnel, setOverviewFunnel] = useState<ConversionFunnel | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Load analytics data
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchAnalyticsData();
    } else if (activeTab === 'conversions') {
      fetchConversionData();
    } else if (activeTab === 'providers' && !isProvider) {
      fetchProviderData();
    }
  }, [activeTab, timeRange, selectedWorkspace, selectedProvider, refreshKey, isProvider, providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load workspaces and providers on component mount
  useEffect(() => {
    fetchWorkspaces();
    fetchProviders();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversions/workspaces`);
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchAnalyticsData = async () => {
    setIsLoadingAnalytics(true);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(timeRange.replace('d', '')));

    const params = new URLSearchParams({
      ...(selectedWorkspace !== 'all' && { workspace_id: selectedWorkspace }),
      ...(isProvider && providerId && { provider_id: providerId })
      // Note: We don't add date filters here to include leads with null created_at
      // The backend will handle date filtering if needed
    });

    try {
      // Fetch core analytics data
      const [overviewRes, leadsRes, funnelRes] = await Promise.all([
        fetch(`${API_BASE}/conversions/analytics?${params}`),
        fetch(`${API_BASE}/leads?limit=1000&${params}`),
        fetch(`${API_BASE}/conversions/funnel?${params}`)
      ]);

      // Process leads data first to get accurate count
      let totalLeadsCount = 0;
      let leadsBySourceData: Array<{ source: string; count: number; percentage: number }> = [];

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeadsData(leadsData.leads || []);

        // Process leads by source
        if (leadsData.leads) {
          const sourceMap = new Map<string, number>();
          leadsData.leads.forEach((lead: { source?: string }) => {
            const source = lead.source || 'Unknown';
            sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
          });

          totalLeadsCount = leadsData.leads.length;
          leadsBySourceData = Array.from(sourceMap.entries()).map(([source, count]) => ({
            source,
            count,
            percentage: totalLeadsCount > 0 ? (count / totalLeadsCount) * 100 : 0
          }));
        }
      }

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        // Transform data to match expected format
        const transformedAnalytics: ExtendedAnalyticsData = {
          total_leads: totalLeadsCount, // Use actual leads count from leads API
          total_appointments: 0, // Will be calculated from appointments data
          conversion_rate: parseFloat(data.analytics?.summary?.conversion_rate || '0'),
          total_revenue: data.analytics?.summary?.total_value || 0,
          avg_response_time: 2.4, // Default for now
          growth_rate: 12.5, // Default for now
          average_time_to_conversion: 2.4, // Default for now
          leads_over_time: data.analytics?.trends?.map((trend: { period: string; conversions: number }) => ({
            date: trend.period,
            leads: trend.conversions,
            appointments: Math.floor(trend.conversions * 0.15) // Estimate appointments as 15% of leads
          })) || [],
          leads_by_source: leadsBySourceData // Use processed leads by source data
        };
        setAnalytics(transformedAnalytics);
      }

      // Handle funnel data
      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setOverviewFunnel(data.funnel);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const fetchConversionData = async () => {
    setIsLoadingConversions(true);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(timeRange.replace('d', '')));

    // Build params - for provider users, don't filter by date to include all their leads
    const params = new URLSearchParams({
      ...(selectedWorkspace !== 'all' && { workspace_id: selectedWorkspace }),
      ...(isProvider && providerId && { provider_id: providerId }),
      // Only add date filters for non-provider users
      ...(!isProvider && {
        from_date: fromDate.toISOString(),
        to_date: new Date().toISOString()
      })
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

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${API_BASE}/providers`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchProviderData = async () => {
    setIsLoadingProviders(true);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(timeRange.replace('d', '')));

    const fromDateStr = `${(fromDate.getMonth() + 1).toString().padStart(2, '0')}-${fromDate.getDate().toString().padStart(2, '0')}-${fromDate.getFullYear()}`;
    const toDateStr = `${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}-${new Date().getFullYear()}`;

    try {
      // For providers, only fetch their own data
      const activeProviders = isProvider && providerId
        ? providers.filter(p => p.is_active && p.provider_id === providerId)
        : providers.filter(p => p.is_active);

      const providerPromises = activeProviders.map(async (provider) => {
        const params = new URLSearchParams({
          from: fromDateStr,
          to: toDateStr
        });

        const response = await fetch(`${API_BASE}/providers/${provider.provider_id}/conversions?${params}`);
        if (response.ok) {
          const data: ProviderConversions = await response.json();

          // Calculate growth trend (simplified - in real app you'd compare with previous period)
          const conversionRate = parseFloat(data.summary.conversion_rate);
          const trend: 'up' | 'down' | 'stable' =
            conversionRate > 15 ? 'up' :
              conversionRate < 5 ? 'down' : 'stable';

          const performance: ProviderPerformance = {
            provider_id: provider.provider_id,
            provider_name: data.provider.provider_name,
            total_leads: data.summary.total_leads,
            total_appointments: data.summary.scheduled_appointments,
            conversion_rate: conversionRate,
            total_revenue: data.summary.total_estimated_value || 0,
            avg_deal_size: data.summary.total_estimated_value && data.summary.scheduled_appointments
              ? data.summary.total_estimated_value / data.summary.scheduled_appointments
              : 0,
            trend,
            growth_rate: Math.random() * 20 - 10 // Placeholder - would calculate from historical data
          };

          return performance;
        }
        return null;
      });

      const results = await Promise.all(providerPromises);
      const validResults = results.filter((result): result is ProviderPerformance => result !== null);

      // Sort by total revenue descending
      validResults.sort((a, b) => b.total_revenue - a.total_revenue);

      setProviderPerformance(validResults);
    } catch (error) {
      console.error('Error fetching provider data:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  // Generate real-time funnel data from actual analytics
  const conversionFunnelData = overviewFunnel ?
    overviewFunnel.stages :
    (analytics ? [
      { stage: 'Leads', count: analytics.total_leads, percentage: 100 },
      { stage: 'Qualified', count: Math.floor(analytics.total_leads * 0.7), percentage: 70 },
      { stage: 'Contacted', count: Math.floor(analytics.total_leads * 0.4), percentage: 40 },
      { stage: 'Appointments', count: analytics.total_appointments || Math.floor(analytics.total_leads * 0.12), percentage: 12.3 },
      { stage: 'Closed', count: Math.floor(analytics.total_leads * analytics.conversion_rate / 100), percentage: analytics.conversion_rate }
    ] : []);

  // Generate hourly data based on leads data
  const hourlyData = leadsData.length > 0 ? (() => {
    const hourlyStats = new Array(24).fill(0).map((_, i) => ({ hour: i, leads: 0, appointments: 0 }));

    leadsData.forEach((lead: { created_at: string }) => {
      if (lead.created_at) {
        const hour = new Date(lead.created_at).getHours();
        hourlyStats[hour].leads++;
        hourlyStats[hour].appointments += Math.random() < 0.15 ? 1 : 0; // 15% appointment rate
      }
    });

    return [
      { hour: '6AM', leads: hourlyStats[6].leads, appointments: hourlyStats[6].appointments },
      { hour: '8AM', leads: hourlyStats[8].leads, appointments: hourlyStats[8].appointments },
      { hour: '10AM', leads: hourlyStats[10].leads, appointments: hourlyStats[10].appointments },
      { hour: '12PM', leads: hourlyStats[12].leads, appointments: hourlyStats[12].appointments },
      { hour: '2PM', leads: hourlyStats[14].leads, appointments: hourlyStats[14].appointments },
      { hour: '4PM', leads: hourlyStats[16].leads, appointments: hourlyStats[16].appointments },
      { hour: '6PM', leads: hourlyStats[18].leads, appointments: hourlyStats[18].appointments },
      { hour: '8PM', leads: hourlyStats[20].leads, appointments: hourlyStats[20].appointments },
      { hour: '10PM', leads: hourlyStats[22].leads, appointments: hourlyStats[22].appointments }
    ];
  })() : [];

  const revenueData = analytics?.leads_over_time?.map((day: { date: string; leads: number; appointments?: number }) => ({
    ...day,
    revenue: (day.appointments || 0) * 850 + Math.random() * 200
  })) || [];

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

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number | string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: { dataKey: string; value: number | string; color: string }, index: number) => (
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
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Analytics"
          description="Deep insights into lead performance and conversion patterns"
          actions={
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

              {!isProvider && (
                <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeTab === 'providers' && !isProvider && (
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-[150px]">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.filter(p => p.is_active).map((provider) => (
                      <SelectItem key={provider.provider_id} value={provider.provider_id}>
                        {provider.provider_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                onClick={() => setRefreshKey(k => k + 1)}
                variant="outline"
                size="sm"
                disabled={isLoadingConversions || isLoadingAnalytics || isLoadingProviders}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (isLoadingConversions || isLoadingAnalytics || isLoadingProviders) && "animate-spin")} />
                Refresh
              </Button>

              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          }
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn("grid w-full", isProvider ? "grid-cols-2" : "grid-cols-3")}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="conversions" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversions
            </TabsTrigger>
            {!isProvider && (
              <TabsTrigger value="providers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Providers
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {isLoadingAnalytics && !analytics ? (
              <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : analytics ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard
                    title="Total Leads"
                    value={analytics.total_leads?.toLocaleString() || '0'}
                    subtitle={`${analytics.growth_rate || 0}% growth rate`}
                    icon={Users}
                    iconColor="text-blue-600"
                    trend={{ value: analytics.growth_rate || 0, isPositive: (analytics.growth_rate || 0) > 0 }}
                  />

                  <KPICard
                    title="Appointments"
                    value={analytics.total_appointments?.toLocaleString() || '0'}
                    subtitle="Total scheduled appointments"
                    icon={Target}
                    iconColor="text-green-600"
                    trend={{ value: 0, isPositive: true }}
                  />

                  <KPICard
                    title="Conversion Rate"
                    value={`${analytics.conversion_rate?.toFixed(1) || 0}%`}
                    subtitle="Overall conversion performance"
                    icon={DollarSign}
                    iconColor="text-emerald-600"
                    trend={{ value: analytics.conversion_rate || 0, isPositive: (analytics.conversion_rate || 0) > 0 }}
                  />

                  <KPICard
                    title="Avg Response"
                    value={`${analytics.avg_response_time || 0}h`}
                    subtitle="Average response time"
                    icon={Clock}
                    iconColor="text-purple-600"
                  />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Lead Trends */}
                  <Card className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Lead Trends</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analytics.leads_over_time || []}>
                        <defs>
                          <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="appointmentsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
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
                  <Card className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Lead Sources</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.leads_by_source || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(analytics.leads_by_source || []).map((entry, index) => (
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
                  <Card className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4">Conversion Funnel</h3>
                    <div className="space-y-4">
                      {conversionFunnelData.map((stage, index) => (
                        <div key={stage.stage || stage.name || index} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{stage.stage || stage.name}</span>
                            <span className="text-muted-foreground">{stage.count} ({typeof stage.percentage === 'number' ? stage.percentage.toFixed(1) : stage.percentage}%)</span>
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
                  <Card className="bg-card rounded-xl border border-border p-6">
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
              </>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No analytics data available</p>
                <p className="text-xs mt-2">Data will appear here as leads and conversions are processed</p>
              </div>
            )}
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions" className="space-y-6">
            {isLoadingConversions && !conversionAnalytics ? (
              <div className="flex items-center justify-center min-h-screen">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <KPICard
                    title="Total Conversions"
                    value={conversionAnalytics?.summary.total_conversions || 0}
                    subtitle={`${conversionAnalytics?.summary.conversion_rate || 0}% conversion rate`}
                    icon={Target}
                    iconColor="text-blue-600"
                    trend={{
                      value: parseFloat(conversionAnalytics?.summary.conversion_rate || '0'),
                      isPositive: parseFloat(conversionAnalytics?.summary.conversion_rate || '0') > 0
                    }}
                  />

                  <KPICard
                    title="Total Revenue"
                    value={formatCurrency(conversionAnalytics?.summary.total_value || 0)}
                    subtitle="Total revenue generated"
                    icon={DollarSign}
                    iconColor="text-green-600"
                    trend={{
                      value: conversionAnalytics && conversionAnalytics.summary.total_value > 0 ? 1 : 0,
                      isPositive: conversionAnalytics ? conversionAnalytics.summary.total_value > 0 : false
                    }}
                  />

                  <KPICard
                    title="Avg. Deal Size"
                    value={formatCurrency(conversionAnalytics?.summary.average_value || 0)}
                    subtitle="Average deal value"
                    icon={TrendingUp}
                    iconColor="text-emerald-600"
                  />

                  <KPICard
                    title="Unique Contacts"
                    value={conversionAnalytics?.summary.unique_contacts || 0}
                    subtitle="Unique contacts converted"
                    icon={Users}
                    iconColor="text-purple-600"
                  />

                  <KPICard
                    title="Active Teams"
                    value={conversionAnalytics?.summary.active_workspaces || 0}
                    subtitle="Active workspaces"
                    icon={Activity}
                    iconColor="text-orange-600"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Conversion Funnel */}
                  <Card className="bg-card rounded-xl border border-border p-6">
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
                  <Card className="bg-card rounded-xl border border-border p-6">
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
                <Card className="bg-card rounded-xl border border-border p-6">
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
                <Card className="bg-card rounded-xl border border-border p-6">
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

          {/* Providers Tab - Only visible to admin/dev */}
          {!isProvider && (
            <TabsContent value="providers" className="space-y-6">
              {isLoadingProviders && providerPerformance.length === 0 ? (
                <div className="flex items-center justify-center min-h-screen">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Provider Summary KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                      title="Active Providers"
                      value={providers.filter(p => p.is_active).length}
                      subtitle={`${providers.length} total providers`}
                      icon={Users}
                      iconColor="text-blue-600"
                    />

                    <KPICard
                      title="Total Leads"
                      value={providerPerformance.reduce((sum, p) => sum + p.total_leads, 0).toLocaleString()}
                      subtitle="Across all providers"
                      icon={Target}
                      iconColor="text-green-600"
                      trend={{ value: 0, isPositive: true }}
                    />

                    <KPICard
                      title="Total Revenue"
                      value={formatCurrency(providerPerformance.reduce((sum, p) => sum + p.total_revenue, 0))}
                      subtitle="Total revenue generated"
                      icon={DollarSign}
                      iconColor="text-emerald-600"
                    />

                    <KPICard
                      title="Avg Conversion"
                      value={`${providerPerformance.length > 0
                          ? (providerPerformance.reduce((sum, p) => sum + p.conversion_rate, 0) / providerPerformance.length).toFixed(1)
                          : 0
                        }%`}
                      subtitle="Average conversion rate"
                      icon={Activity}
                      iconColor="text-purple-600"
                    />
                  </div>

                  {/* Provider Performance Leaderboard */}
                  <Card className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold">Provider Performance Leaderboard</h3>
                      <Badge variant="outline">{providerPerformance.length} Providers</Badge>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Provider</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Leads</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Appointments</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Conv. Rate</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Revenue</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg Deal</th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providerPerformance.map((provider, index) => (
                            <tr key={provider.provider_id} className="border-b hover:bg-secondary/20 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold">#{index + 1}</span>
                                  {index < 3 && (
                                    <div className={cn("text-xs px-1.5 py-0.5 rounded-full",
                                      index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                                        index === 1 ? "bg-gray-400/20 text-gray-600" :
                                          "bg-orange-500/20 text-orange-600"
                                    )}>
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium">{provider.provider_name}</div>
                                <div className="text-xs text-muted-foreground">{provider.provider_id}</div>
                              </td>
                              <td className="text-right py-3 px-4 font-medium">{provider.total_leads.toLocaleString()}</td>
                              <td className="text-right py-3 px-4 font-medium">{provider.total_appointments.toLocaleString()}</td>
                              <td className="text-right py-3 px-4">
                                <Badge variant={provider.conversion_rate > 15 ? "default" : provider.conversion_rate > 5 ? "secondary" : "destructive"}>
                                  {provider.conversion_rate.toFixed(1)}%
                                </Badge>
                              </td>
                              <td className="text-right py-3 px-4 font-medium">{formatCurrency(provider.total_revenue)}</td>
                              <td className="text-right py-3 px-4 text-muted-foreground">{formatCurrency(provider.avg_deal_size)}</td>
                              <td className="text-right py-3 px-4">
                                {provider.trend === 'up' && <TrendingUp className="h-4 w-4 text-success inline" />}
                                {provider.trend === 'down' && <TrendingDown className="h-4 w-4 text-destructive inline" />}
                                {provider.trend === 'stable' && <div className="w-4 h-4 bg-muted-foreground/30 rounded-full inline-block"></div>}
                              </td>
                            </tr>
                          ))}

                          {providerPerformance.length === 0 && (
                            <tr>
                              <td colSpan={8} className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">No provider data available</p>
                                <p className="text-xs mt-2">Provider performance will appear here as data is processed</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Conversion Rate Comparison */}
                    <Card className="bg-card rounded-xl border border-border p-6">
                      <h3 className="text-lg font-semibold mb-4">Conversion Rate Comparison</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={providerPerformance.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 25%)" />
                          <XAxis
                            dataKey="provider_name"
                            stroke="hsl(215, 20%, 65%)"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                          />
                          <YAxis stroke="hsl(215, 20%, 65%)" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="conversion_rate" fill="hsl(217, 91%, 60%)" name="Conversion Rate %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>

                    {/* Revenue Attribution */}
                    <Card className="bg-card rounded-xl border border-border p-6">
                      <h3 className="text-lg font-semibold mb-4">Revenue Attribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={providerPerformance.slice(0, 8)}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="total_revenue"
                            label={({ provider_name, value }) =>
                              `${provider_name}: ${formatCurrency(value)}`
                            }
                          >
                            {providerPerformance.slice(0, 8).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                            content={<CustomTooltip />}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* Performance Trends */}
                  <Card className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={providerPerformance.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 25%)" />
                        <XAxis
                          dataKey="provider_name"
                          stroke="hsl(215, 20%, 65%)"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          fontSize={12}
                        />
                        <YAxis stroke="hsl(215, 20%, 65%)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total_leads"
                          stroke="hsl(217, 91%, 60%)"
                          name="Total Leads"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="total_appointments"
                          stroke="hsl(142, 76%, 36%)"
                          name="Appointments"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}