import { Layout } from '@/components/dashboard/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  Zap
} from 'lucide-react';
import { mockAnalytics, mockWorkspaces } from '@/data/mockData';
import { useState } from 'react';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(215, 20%, 65%)'];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedWorkspace, setSelectedWorkspace] = useState('all');

  const analytics = mockAnalytics;

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
            <h1 className="text-3xl font-bold gradient-text">Advanced Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Deep insights into lead performance and conversion patterns
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workspaces</SelectItem>
                {mockWorkspaces.map(workspace => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lead Velocity</p>
                <p className="text-2xl font-bold text-foreground">47.2/day</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-primary">
                <Zap className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-center text-sm mt-2">
              <TrendingUp className="w-4 h-4 text-success mr-1" />
              <span className="text-success">+12.5%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Lead Value</p>
                <p className="text-2xl font-bold text-foreground">$93.56</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-success">
                <DollarSign className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
            <div className="flex items-center text-sm mt-2">
              <TrendingUp className="w-4 h-4 text-success mr-1" />
              <span className="text-success">+8.3%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Close Rate</p>
                <p className="text-2xl font-bold text-foreground">5.6%</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-primary">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-center text-sm mt-2">
              <TrendingDown className="w-4 h-4 text-destructive mr-1" />
              <span className="text-destructive">-2.1%</span>
              <span className="text-muted-foreground ml-1">vs last period</span>
            </div>
          </Card>

          <Card className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Time to Close</p>
                <p className="text-2xl font-bold text-foreground">2.4 days</p>
              </div>
              <div className="p-3 rounded-lg bg-gradient-success">
                <Clock className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
            <div className="flex items-center text-sm mt-2">
              <TrendingUp className="w-4 h-4 text-success mr-1" />
              <span className="text-success">-0.3 days</span>
              <span className="text-muted-foreground ml-1">faster</span>
            </div>
          </Card>
        </div>

        {/* Main Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="conversion">Conversion</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Lead Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Lead Trends (7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.leads_over_time}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="hsl(217, 91%, 60%)" 
                      fill="hsl(217, 91%, 60%)" 
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="appointments" 
                      stroke="hsl(142, 76%, 36%)" 
                      fill="hsl(142, 76%, 36%)" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Hourly Lead Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leads" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sources" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Lead Sources Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.leads_by_source}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.leads_by_source.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Source Performance</h3>
                <div className="space-y-4">
                  {analytics.leads_by_source.map((source, index) => {
                    const conversionRate = 8 + Math.random() * 10; // Mock conversion rates
                    const cost = Math.floor(Math.random() * 50) + 20; // Mock cost per lead
                    
                    return (
                      <div key={source.source} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium text-foreground">{source.source}</p>
                            <p className="text-sm text-muted-foreground">{source.count} leads</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline">{conversionRate.toFixed(1)}%</Badge>
                            <span className="text-sm text-muted-foreground">${cost}/lead</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conversion" className="space-y-6">
            <Card className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-6 text-foreground">Conversion Funnel</h3>
              <div className="space-y-4">
                {conversionFunnelData.map((stage, index) => (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-foreground">{stage.count.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground ml-2">({stage.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full bg-gradient-primary"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                    {index < conversionFunnelData.length - 1 && (
                      <div className="flex justify-center mt-2">
                        <div className="text-xs text-muted-foreground bg-background px-2 py-1 rounded border">
                          -{((conversionFunnelData[index].percentage - conversionFunnelData[index + 1].percentage)).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Revenue Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="glass-card p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2">${analytics.total_revenue.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mb-4">Total Revenue</div>
                <div className="flex items-center justify-center text-success text-sm">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +15.3% vs last period
                </div>
              </Card>

              <Card className="glass-card p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2">$760</div>
                <div className="text-sm text-muted-foreground mb-4">Avg. Deal Size</div>
                <div className="flex items-center justify-center text-success text-sm">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +8.7% vs last period
                </div>
              </Card>

              <Card className="glass-card p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2">$93.56</div>
                <div className="text-sm text-muted-foreground mb-4">Revenue per Lead</div>
                <div className="flex items-center justify-center text-warning text-sm">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  -2.1% vs last period
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}