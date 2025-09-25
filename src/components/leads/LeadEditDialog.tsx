import { useState, useEffect } from 'react';
import { Lead, leadStatuses } from '@/data/leadsData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LeadEditDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (updatedLead: Lead) => void;
}

interface LeadEditForm {
  status: string;
  assignedTo: string;
  value: number;
  notes: string;
  priority: number;
  source: string;
}

export function LeadEditDialog({ lead, open, onOpenChange, onSave }: LeadEditDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<LeadEditForm>({
    status: '',
    assignedTo: '',
    value: 0,
    notes: '',
    priority: 1,
    source: ''
  });

  const API_BASE = import.meta.env.DEV ? 'http://localhost:8890' : 'https://api.homeprojectpartners.com';

  // Initialize form when lead changes
  useEffect(() => {
    if (lead && open) {
      setForm({
        status: lead.status,
        assignedTo: lead.assignedTo || '',
        value: lead.value || 0,
        notes: lead.notes || '',
        priority: 1, // Default priority
        source: lead.source || ''
      });
    }
  }, [lead, open]);

  const handleSave = async () => {
    if (!lead) return;

    setIsLoading(true);
    try {
      // Update lead via API
      const response = await fetch(`${API_BASE}/leads/${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: form.status,
          assigned_to: form.assignedTo,
          revenue_potential: form.value,
          notes: form.notes,
          priority: form.priority,
          source: form.source
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update lead');
      }

      const result = await response.json();

      // Create updated lead object
      const updatedLead: Lead = {
        ...lead,
        status: form.status as Lead['status'],
        assignedTo: form.assignedTo,
        value: form.value,
        notes: form.notes,
        source: form.source
      };

      // Call parent callback
      onSave?.(updatedLead);

      toast({
        title: "Lead Updated",
        description: `Lead ${lead.name} has been successfully updated.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update lead:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update lead. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (lead) {
      setForm({
        status: lead.status,
        assignedTo: lead.assignedTo || '',
        value: lead.value || 0,
        notes: lead.notes || '',
        priority: 1,
        source: lead.source || ''
      });
    }
    onOpenChange(false);
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center space-x-2">
            <span>Edit Lead - {lead.name}</span>
            <Badge variant="outline" className="text-xs">
              #{lead.id}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information (Read-only) */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Contact Information (Read-only)</Label>
            <div className="mt-2 p-4 bg-secondary/20 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span> {lead.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> {lead.email}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span> {lead.phone}
                </div>
                <div>
                  <span className="text-muted-foreground">Company:</span> {lead.company}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${status.color.replace('bg-', 'bg-')}`} />
                          <span>{status.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div>
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Input
                  id="assignedTo"
                  value={form.assignedTo}
                  onChange={(e) => setForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                  placeholder="Enter assignee name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Deal Value */}
              <div>
                <Label htmlFor="value">Deal Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="100"
                  value={form.value}
                  onChange={(e) => setForm(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              {/* Source */}
              <div>
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={form.source}
                  onChange={(e) => setForm(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="Lead source"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this lead..."
                rows={4}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}