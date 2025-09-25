import { Card } from '@/components/ui/card';
import { KPICard } from '@/components/dashboard/KPICard';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { mockAnalytics, mockWorkspaces } from '@/data/mockData';

export default function Dashboard() {
  const analytics = mockAnalytics;

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
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Leads"
          value={analytics.total_leads.toLocaleString()}
          icon={Users}
          trend={{ value: 8.2, isPositive: true }}
        />
        <KPICard
          title="Appointments Set"
          value={analytics.total_appointments.toLocaleString()}
          icon={Calendar}
          trend={{ value: 12.5, isPositive: true }}
        />
        <KPICard
          title="Conversion Rate"
          value={`${analytics.conversion_rate}%`}
          icon={TrendingUp}
          trend={{ value: 2.1, isPositive: true }}
        />
        <KPICard
          title="Total Revenue"
          value={`$${analytics.total_revenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 15.3, isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Source */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Leads by Source</h3>
          <div className="space-y-4">
            {analytics.leads_by_source.map((source, index) => (
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
            ))}
          </div>
        </Card>

        {/* Recent Performance */}
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">7-Day Performance</h3>
          <div className="space-y-3">
            {analytics.leads_over_time.slice(-7).map((day, index) => (
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
            ))}
          </div>
        </Card>
      </div>

      {/* Workspace Overview */}
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6 text-foreground">Workspace Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockWorkspaces.map((workspace) => (
            <div key={workspace.id} className="p-4 rounded-lg border border-border/50 bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground truncate">{workspace.name}</h4>
                <div className={`flex items-center text-xs ${
                  workspace.conversion_rate > 12 ? 'text-success' : 
                  workspace.conversion_rate > 8 ? 'text-warning' : 'text-muted-foreground'
                }`}>
                  {workspace.conversion_rate > 12 ? 
                    <ArrowUpRight className="w-3 h-3 mr-1" /> : 
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                  }
                  {workspace.conversion_rate}%
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads:</span>
                  <span className="text-foreground font-medium">{workspace.total_leads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue:</span>
                  <span className="text-foreground font-medium">${workspace.total_revenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}