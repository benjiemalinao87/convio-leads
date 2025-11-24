import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Generate workspace ID from workspace name
 * Format: lowercase, replace spaces/special chars with underscores, remove multiple underscores
 */
function generateWorkspaceId(name: string): string {
  if (!name.trim()) return '';
  
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50); // Limit length
}

export function CreateWorkspaceDialog({ open, onOpenChange, onSuccess }: CreateWorkspaceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const { toast } = useToast();

  // Auto-generate workspace ID from name
  const generatedWorkspaceId = useMemo(() => {
    return generateWorkspaceId(workspaceName);
  }, [workspaceName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workspaceName.trim()) {
      toast({
        title: "Error",
        description: "Workspace name is required",
        variant: "destructive",
      });
      return;
    }

    if (!generatedWorkspaceId) {
      toast({
        title: "Error",
        description: "Please enter a valid workspace name",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('https://api.homeprojectpartners.com/conversions/workspace/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: generatedWorkspaceId,
          name: workspaceName.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Workspace "${workspaceName}" created successfully`,
        });

        // Reset form
        setWorkspaceName('');
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create workspace",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setWorkspaceName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Create New Workspace
          </DialogTitle>
          <DialogDescription>
            Create a new workspace for appointment routing. The workspace ID will be automatically generated from the name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name *</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., Solar West Coast Team"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Display name for the workspace
              </p>
            </div>

            {/* Auto-generated Workspace ID Preview */}
            {generatedWorkspaceId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  Workspace ID (Auto-generated)
                </Label>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                  <code className="text-sm font-mono text-foreground flex-1">
                    {generatedWorkspaceId}
                  </code>
                  <Badge variant="secondary" className="text-xs">
                    Auto
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  This ID is automatically generated from the workspace name and will be used as a unique identifier.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

