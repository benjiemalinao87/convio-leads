import { useState } from 'react';
import { Layout } from '@/components/dashboard/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { mockWorkspaces } from '@/data/mockData';
import { 
  Plus, 
  Copy, 
  ExternalLink, 
  Calendar,
  Users,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState(mockWorkspaces);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const { toast } = useToast();

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) return;

    const newWorkspace = {
      id: (workspaces.length + 1).toString(),
      name: newWorkspaceName,
      webhook_url: `https://api.leadmanager.com/webhook/ws_${Date.now()}`,
      created_at: new Date().toISOString(),
      total_leads: 0,
      conversion_rate: 0,
      total_revenue: 0
    };

    setWorkspaces([...workspaces, newWorkspace]);
    setNewWorkspaceName('');
    setIsCreateDialogOpen(false);
    
    toast({
      title: "Workspace Created",
      description: `${newWorkspace.name} has been created successfully.`,
    });
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied to Clipboard",
      description: "Webhook URL copied successfully.",
    });
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Workspaces</h1>
            <p className="text-muted-foreground mt-1">
              Manage your lead collection workspaces and webhook endpoints
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:bg-primary/90 shadow-glow">
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="e.g., Solar Leads - California"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim()}>
                    Create Workspace
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workspaces Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="glass-card p-6 transition-all duration-300 hover:shadow-glow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">{workspace.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(workspace.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={workspace.total_leads > 0 ? "default" : "secondary"}>
                  {workspace.total_leads > 0 ? "Active" : "New"}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Leads</p>
                    <p className="font-semibold text-foreground">{workspace.total_leads}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conversion</p>
                    <p className="font-semibold text-foreground">{workspace.conversion_rate}%</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-warning" />
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="font-semibold text-foreground">${workspace.total_revenue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Time</p>
                    <p className="font-semibold text-foreground">2.4 days</p>
                  </div>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="border border-border/50 rounded-lg p-3 bg-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">Webhook URL</Label>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyWebhookUrl(workspace.webhook_url)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs font-mono text-foreground break-all bg-background/50 p-2 rounded border">
                  {workspace.webhook_url}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {workspaces.length === 0 && (
          <Card className="glass-card p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <Plus className="w-12 h-12 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Workspaces Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first workspace to start collecting leads via webhooks.
            </p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-primary hover:bg-primary/90"
            >
              Create First Workspace
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}