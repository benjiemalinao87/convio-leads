import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  Users,
  Calendar,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// API interfaces
interface APIStatistics {
  total_leads: number;
  unique_webhooks: number;
  days_active: number;
  first_lead_date: string;
  last_lead_date: string;
  conversion_rate: number;
  status_breakdown: {
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    rejected: number;
  };
}

interface APIWebhook {
  id: string;
  name: string;
  type: string;
  region: string;
  category: string;
  enabled: boolean;
  total_leads: number;
  conversion_rate: number;
  total_revenue: number;
  created_at: string;
  last_lead_at: string | null;
}

interface APILead {
  id: number;
  source: string;
  created_at: string;
  status: string;
}

export default function Dashboard() {
  const [statistics, setStatistics] = useState<APIStatistics | null>(null);
  const [webhooks, setWebhooks] = useState<APIWebhook[]>([]);
  const [recentLeads, setRecentLeads] = useState<APILead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = import.meta.env.DEV ? 'http://localhost:8890' : 'https://api.homeprojectpartners.com';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [statsResponse, webhooksResponse, leadsResponse] = await Promise.all([
        fetch(`${API_BASE}/leads/statistics`),
        fetch(`${API_BASE}/webhook`),
        fetch(`${API_BASE}/leads?limit=20`)
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData.statistics);
      }

      if (webhooksResponse.ok) {
        const webhooksData = await webhooksResponse.json();
        setWebhooks(webhooksData.webhooks || []);
      }

      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json();
        setRecentLeads(leadsData.leads || []);
      }

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate lead source distribution
  const getLeadsBySource = () => {
    if (!recentLeads.length) return [];

    const sourceCount: { [key: string]: number } = {};
    recentLeads.forEach(lead => {
      sourceCount[lead.source] = (sourceCount[lead.source] || 0) + 1;
    });

    const total = recentLeads.length;
    return Object.entries(sourceCount)
      .map(([source, count]) => ({
        source,
        count,
        percentage: ((count / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  };

  // Calculate recent daily activity
  const getDailyActivity = () => {
    if (!recentLeads.length) return [];

    const dailyCount: { [key: string]: { leads: number; appointments: number } } = {};

    recentLeads.forEach(lead => {
      const date = new Date(lead.created_at).toDateString();
      if (!dailyCount[date]) {
        dailyCount[date] = { leads: 0, appointments: 0 };
      }
      dailyCount[date].leads++;
      if (['scheduled', 'converted'].includes(lead.status)) {
        dailyCount[date].appointments++;
      }
    });

    return Object.entries(dailyCount)
      .map(([date, counts]) => ({
        date: new Date(date).toISOString(),
        leads: counts.leads,
        appointments: counts.appointments
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);
  };

  // Calculate total revenue from webhooks
  const getTotalRevenue = () => {
    return webhooks.reduce((total, webhook) => total + (webhook.total_revenue || 0), 0);
  };

  // Calculate total appointments (qualified + converted + scheduled)
  const getTotalAppointments = () => {
    if (!statistics) return 0;
    return statistics.status_breakdown.qualified + statistics.status_breakdown.converted;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Dashboard Overview</h1>
            <p className="text-muted-foreground mt-1">Loading dashboard data...</p>
          </div>
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Dashboard Overview</h1>
            <p className="text-muted-foreground mt-1">Error loading dashboard data</p>
          </div>
          <Button onClick={fetchDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Card className="glass-card p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const leadsBySource = getLeadsBySource();
  const dailyActivity = getDailyActivity();
  const totalRevenue = getTotalRevenue();
  const totalAppointments = getTotalAppointments();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Track your lead performance and conversion metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </div>
          <Button onClick={fetchDashboardData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Leads"
          value={statistics?.total_leads?.toLocaleString() || '0'}
          icon={Users}
          trend={{ value: statistics?.total_leads || 0 > 0 ? 8.2 : 0, isPositive: true }}
        />
        <KPICard
          title="Appointments Set"
          value={totalAppointments.toLocaleString()}
          icon={Calendar}
          trend={{ value: totalAppointments > 0 ? 12.5 : 0, isPositive: true }}
        />
        <KPICard
          title="Conversion Rate"
          value={`${statistics?.conversion_rate || 0}%`}
          icon={TrendingUp}
          trend={{ value: statistics?.conversion_rate || 0, isPositive: (statistics?.conversion_rate || 0) > 0 }}
        />
        <KPICard
          title="Active Webhooks"
          value={webhooks.filter(w => w.total_leads > 0).length.toString()}
          icon={Activity}
          trend={{ value: webhooks.length, isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Source */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Leads by Source</h3>
          <div className="space-y-4">
            {leadsBySource.length > 0 ? leadsBySource.map((source, index) => (
              <div key={source.source} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    index === 0 ? 'bg-primary' :
                    index === 1 ? 'bg-accent' :
                    index === 2 ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <span className="text-sm font-medium text-foreground">{source.source}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">{source.count}</div>
                  <div className="text-xs text-muted-foreground">{source.percentage}%</div>
                </div>
              </div>
            )) : (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No lead source data available</p>
                <p className="text-xs mt-2">Leads will appear here as they are received</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Performance */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Activity</h3>
          <div className="space-y-3">
            {dailyActivity.length > 0 ? dailyActivity.map((day) => (
              <div key={day.date} className="flex items-center justify-between py-2">
                <div className="text-sm text-muted-foreground">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">{day.leads} leads</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-sm text-foreground">{day.appointments} appts</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-2">Activity will appear here as leads are processed</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Webhook Overview */}
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6 text-foreground">Webhook Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="p-4 rounded-lg border border-border/50 bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground truncate">{webhook.name}</h4>
                <div className={`flex items-center text-xs ${
                  webhook.conversion_rate > 12 ? 'text-success' :
                  webhook.conversion_rate > 8 ? 'text-warning' : 'text-muted-foreground'
                }`}>
                  {webhook.conversion_rate > 12 ?
                    <ArrowUpRight className="w-3 h-3 mr-1" /> :
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                  }
                  {webhook.conversion_rate}%
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads:</span>
                  <span className="text-foreground font-medium">{webhook.total_leads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue:</span>
                  <span className="text-foreground font-medium">${webhook.total_revenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}