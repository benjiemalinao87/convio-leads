import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForwardingRulesList } from './ForwardingRulesList';
import { ForwardingLog } from './ForwardingLog';
import { Route, Activity } from 'lucide-react';

interface ForwardingManagementDialogProps {
  webhookId: string;
  webhookName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ForwardingRule {
  id: number;
  source_webhook_id: string;
  target_webhook_id: string;
  target_webhook_url: string;
  product_types: string[];
  zip_codes: string[];
  priority: number;
  is_active: boolean;
  forward_enabled: boolean;
  notes: string | null;
  created_at: string;
}

export function ForwardingManagementDialog({
  webhookId,
  webhookName,
  open,
  onOpenChange,
}: ForwardingManagementDialogProps) {
  const [rules, setRules] = useState<ForwardingRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-rules`
      );
      const data = await response.json();

      if (data.success) {
        setRules(data.rules || []);
      }
    } catch (error) {
      console.error('Error fetching forwarding rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRules();
    }
  }, [open, webhookId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Lead Forwarding - {webhookName}</DialogTitle>
          <DialogDescription>
            Manage automatic lead forwarding rules and view forwarding activity logs
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="rules" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Forwarding Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="flex-1 overflow-y-auto mt-4">
            <ForwardingRulesList
              webhookId={webhookId}
              rules={rules}
              onRefresh={fetchRules}
            />
          </TabsContent>

          <TabsContent value="logs" className="flex-1 overflow-y-auto mt-4">
            <ForwardingLog webhookId={webhookId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

