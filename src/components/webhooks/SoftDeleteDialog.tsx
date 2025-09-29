import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Info
} from 'lucide-react';

interface SoftDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  webhookId: string;
  webhookName: string;
  onDeleteConfirm: (webhookId: string, reason: string, forceDelete: boolean) => Promise<void>;
  isDeleting: boolean;
}

export default function SoftDeleteDialog({
  isOpen,
  onClose,
  webhookId,
  webhookName,
  onDeleteConfirm,
  isDeleting
}: SoftDeleteDialogProps) {
  const [deletionReason, setDeletionReason] = useState('');
  const [forceDelete, setForceDelete] = useState(false);

  const handleConfirm = async () => {
    await onDeleteConfirm(
      webhookId,
      deletionReason || 'No reason provided',
      forceDelete
    );

    // Reset form
    setDeletionReason('');
    setForceDelete(false);
  };

  const handleClose = () => {
    setDeletionReason('');
    setForceDelete(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Webhook
          </DialogTitle>
          <DialogDescription>
            You are about to delete "{webhookName}". Choose your deletion method below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Soft Delete Information */}
          {!forceDelete && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Soft Delete (Recommended):</strong> The webhook will be disabled immediately
                but can be restored within 24 hours. After 24 hours, it will be permanently deleted.
              </AlertDescription>
            </Alert>
          )}

          {/* Force Delete Warning */}
          {forceDelete && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Permanent Delete:</strong> The webhook configuration will be permanently
                removed immediately. This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          {/* Deletion Reason */}
          <div className="space-y-2">
            <Label htmlFor="deletion-reason">
              Reason for deletion {!forceDelete && '(optional)'}
            </Label>
            <Textarea
              id="deletion-reason"
              placeholder="e.g., No longer needed, migrating to new system, testing purposes..."
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Force Delete Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="force-delete"
              checked={forceDelete}
              onCheckedChange={(checked) => setForceDelete(checked as boolean)}
            />
            <Label
              htmlFor="force-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Permanently delete immediately (cannot be restored)
            </Label>
          </div>

          {/* Preservation Notice */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              All leads data associated with this webhook will be preserved regardless
              of the deletion method chosen.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isDeleting || (!forceDelete && !deletionReason.trim() && deletionReason.length === 0)}
            variant={forceDelete ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              'Deleting...'
            ) : forceDelete ? (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Soft Delete (24h)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}