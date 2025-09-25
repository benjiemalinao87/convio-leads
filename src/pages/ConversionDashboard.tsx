import { useState, useEffect } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Activity,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Filter,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
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

export default function ConversionDashboard() {
  const [analytics, setAnalytics] = useState<ConversionAnalytics | null>(null);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [recentConversions, setRecentConversions] = useState<Conversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    fetchData();
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [dateRange, workspaceFilter, refreshKey]);

  const fetchData = async () => {
    setIsLoading(true);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(dateRange));

    const params = new URLSearchParams({
      from_date: fromDate.toISOString(),
      to_date: new Date().toISOString(),
      ...(workspaceFilter !== 'all' && { workspace_id: workspaceFilter })
    });

    try {
      const [analyticsRes, funnelRes, conversionsRes] = await Promise.all([
        fetch(`${API_BASE}/conversions/analytics?${params}`),
        fetch(`${API_BASE}/conversions/funnel?${params}`),
        fetch(`${API_BASE}/conversions?${params}&limit=10`)
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

      if (funnelRes.ok) {
        const data = await funnelRes.json();
        setFunnel(data.funnel);
      }

      if (conversionsRes.ok) {
        const data = await conversionsRes.json();
        setRecentConversions(data.conversions || []);
      }
    } catch (error) {
      console.error('Error fetching conversion data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (isLoading && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Conversion Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track conversion performance and revenue metrics
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Date Range Filter */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setRefreshKey(k => k + 1)}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-xs">
              +{analytics?.summary.conversion_rate || 0}%
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{analytics?.summary.total_conversions || 0}</p>
            <p className="text-xs text-muted-foreground">Total Conversions</p>
          </div>
        </Card>

        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-success/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            {analytics && analytics.summary.total_value > 0 && (
              <ArrowUpRight className="h-4 w-4 text-success" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">
              {formatCurrency(analytics?.summary.total_value || 0)}
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
              {formatCurrency(analytics?.summary.average_value || 0)}
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
            <p className="text-2xl font-bold">{analytics?.summary.unique_contacts || 0}</p>
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
            <p className="text-2xl font-bold">{analytics?.summary.active_workspaces || 0}</p>
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
            {funnel?.stages.map((stage, index) => (
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
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Conversion Rate</span>
              <span className="text-2xl font-bold text-primary">
                {funnel?.conversion_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>

        {/* Conversion by Type */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">By Type</h3>
            <Filter className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-3">
            {analytics?.by_type.map(type => (
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
              <div className="text-center py-8 text-muted-foreground">
                No conversion data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Workspace Performance Table */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Workspace Performance</h3>
          <Badge variant="outline">{analytics?.by_workspace.length || 0} Active</Badge>
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
              {analytics?.by_workspace.map(workspace => (
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
          )) || (
            <div className="text-center py-8 text-muted-foreground">
              No recent conversions
            </div>
          )}
        </div>
      </Card>
      </div>
    </Layout>
  );
}