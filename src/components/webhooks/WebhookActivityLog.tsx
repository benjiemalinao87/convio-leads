import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Activity, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  service_type?: string;
  status?: string;
  created_at: string;
  raw_payload?: string | null;
  source?: string;
  zip_code?: string;
  state?: string;
}

interface WebhookActivityLogProps {
  webhookId: string;
  className?: string;
}

export function WebhookActivityLog({ webhookId, className }: WebhookActivityLogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { toast } = useToast();

  const API_BASE = 'https://api.homeprojectpartners.com';

  useEffect(() => {
    if (isOpen) {
      fetchRecentLeads();
    }
  }, [isOpen, webhookId]);

  const fetchRecentLeads = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/leads?webhook_id=${webhookId}&limit=10`);

      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recent leads',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyJSON = (lead: Lead) => {
    const jsonPayload = lead.raw_payload || JSON.stringify(lead, null, 2);
    navigator.clipboard.writeText(jsonPayload);
    setCopiedId(lead.id);

    toast({
      title: 'Copied',
      description: 'JSON payload copied to clipboard',
    });

    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'contacted':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'qualified':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'unqualified':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("w-full", className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-3 hover:bg-accent/50"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Activity Log</span>
            {!isOpen && leads.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {leads.length} recent
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No leads received yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {leads.map((lead) => (
              <Card key={lead.id} className="border-l-4 border-l-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-semibold">
                        {lead.first_name} {lead.last_name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{lead.email}</span>
                        <span>•</span>
                        <span>{lead.phone}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </span>
                      {lead.status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            getStatusColor(lead.status)
                          )}
                        >
                          {lead.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Lead details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {lead.service_type && (
                      <div>
                        <span className="text-muted-foreground">Service:</span>
                        <span className="ml-2 font-medium">{lead.service_type}</span>
                      </div>
                    )}
                    {lead.source && (
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <span className="ml-2 font-medium">{lead.source}</span>
                      </div>
                    )}
                    {lead.state && (
                      <div>
                        <span className="text-muted-foreground">State:</span>
                        <span className="ml-2 font-medium">{lead.state}</span>
                      </div>
                    )}
                    {lead.zip_code && (
                      <div>
                        <span className="text-muted-foreground">Zip:</span>
                        <span className="ml-2 font-medium">{lead.zip_code}</span>
                      </div>
                    )}
                  </div>

                  {/* JSON Payload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Inbound Payload
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyJSON(lead)}
                        className="h-6 px-2 text-xs"
                      >
                        {copiedId === lead.id ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-48">
                      <code>
                        {lead.raw_payload
                          ? JSON.stringify(JSON.parse(lead.raw_payload), null, 2)
                          : JSON.stringify(lead, null, 2)}
                      </code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {leads.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecentLeads}
            className="w-full mt-2"
            disabled={isLoading}
          >
            Refresh Activity
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
