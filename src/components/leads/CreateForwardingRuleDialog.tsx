import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateForwardingRuleDialogProps {
  webhookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  target_webhook_id: string;
  target_webhook_url: string;
  product_types: string[];
  zip_codes: string[];
  states: string[];
  priority: number;
  forward_enabled: boolean;
  notes: string;
}

// Available product types (can be extended)
const PRODUCT_TYPES = [
  'Solar',
  'Kitchen',
  'Bath',
  'HVAC',
  'Roofing',
  'Windows',
  'Siding',
  'Flooring',
  'Landscaping',
  'Pool',
  'Insurance',
];

// US States
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export function CreateForwardingRuleDialog({ webhookId, open, onOpenChange, onSuccess }: CreateForwardingRuleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    target_webhook_id: '',
    target_webhook_url: '',
    product_types: [],
    zip_codes: [],
    states: ['*'], // Default to all states
    priority: 1,
    forward_enabled: true,
    notes: '',
  });

  const [newProductType, setNewProductType] = useState('');
  const [newZipCode, setNewZipCode] = useState('');
  const [newState, setNewState] = useState('');
  const [zipCodesText, setZipCodesText] = useState('');

  // Quick action: Create catch-all rule template
  const fillCatchAllTemplate = () => {
    setFormData(prev => ({
      ...prev,
      product_types: ['*'],
      zip_codes: ['*'],
      states: ['*'],
      priority: 999,
      notes: 'Catch-all fallback for new markets and unlisted zip codes'
    }));
    toast({
      title: "Catch-All Template Applied",
      description: "Rule configured to match all products, zip codes, and states. Set priority 999 as fallback.",
    });
  };

  const handleAddProductType = (productType: string) => {
    if (productType && !formData.product_types.includes(productType)) {
      setFormData(prev => ({
        ...prev,
        product_types: [...prev.product_types, productType]
      }));
    }
    setNewProductType('');
  };

  const handleRemoveProductType = (productType: string) => {
    setFormData(prev => ({
      ...prev,
      product_types: prev.product_types.filter(type => type !== productType)
    }));
  };

  const handleAddZipCode = () => {
    if (newZipCode && !formData.zip_codes.includes(newZipCode)) {
      // Validate zip code format (basic US zip code validation)
      const zipPattern = /^\d{5}(-\d{4})?$/;
      if (!zipPattern.test(newZipCode)) {
        toast({
          title: "Invalid Zip Code",
          description: "Please enter a valid 5-digit US zip code",
          variant: "destructive",
        });
        return;
      }
      setFormData(prev => ({
        ...prev,
        zip_codes: [...prev.zip_codes, newZipCode]
      }));
      setNewZipCode('');
    }
  };

  const handleRemoveZipCode = (zipCode: string) => {
    setFormData(prev => ({
      ...prev,
      zip_codes: prev.zip_codes.filter(zip => zip !== zipCode)
    }));
  };

  const handleBulkAddZipCodes = () => {
    const zipCodes = zipCodesText
      .split(/[,\n\s]+/)
      .map(zip => zip.trim())
      .filter(zip => zip.length > 0);

    const validZipCodes: string[] = [];
    const invalidZipCodes: string[] = [];
    const zipPattern = /^\d{5}(-\d{4})?$/;

    zipCodes.forEach(zip => {
      if (zipPattern.test(zip) && !formData.zip_codes.includes(zip)) {
        validZipCodes.push(zip);
      } else if (!zipPattern.test(zip)) {
        invalidZipCodes.push(zip);
      }
    });

    if (validZipCodes.length > 0) {
      setFormData(prev => ({
        ...prev,
        zip_codes: [...new Set([...prev.zip_codes, ...validZipCodes])]
      }));
      toast({
        title: "Success",
        description: `Added ${validZipCodes.length} zip codes`,
      });
      setZipCodesText('');
    }

    if (invalidZipCodes.length > 0) {
      toast({
        title: "Warning",
        description: `${invalidZipCodes.length} invalid zip codes were skipped`,
        variant: "destructive",
      });
    }
  };

  const handleAddState = (state: string) => {
    if (state && !formData.states.includes(state)) {
      // Remove wildcard if adding specific states
      const updatedStates = formData.states.includes('*')
        ? [state]
        : [...formData.states, state];
      setFormData(prev => ({
        ...prev,
        states: updatedStates
      }));
    }
    setNewState('');
  };

  const handleRemoveState = (state: string) => {
    const updatedStates = formData.states.filter(s => s !== state);
    // If no states left, default back to wildcard
    setFormData(prev => ({
      ...prev,
      states: updatedStates.length > 0 ? updatedStates : ['*']
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvError('');
    setCsvPreview([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);

      const zipCodes: string[] = [];
      const zipPattern = /^\d{5}(-\d{4})?$/;

      lines.forEach(line => {
        const values = line.split(',').map(v => v.trim());
        values.forEach(value => {
          if (zipPattern.test(value)) {
            zipCodes.push(value);
          }
        });
      });

      if (zipCodes.length === 0) {
        setCsvError('No valid zip codes found in file');
        return;
      }

      setCsvPreview(zipCodes.slice(0, 10)); // Show first 10
      setFormData(prev => ({
        ...prev,
        zip_codes: [...new Set([...prev.zip_codes, ...zipCodes])]
      }));

      toast({
        title: "Success",
        description: `Loaded ${zipCodes.length} zip codes from CSV`,
      });
    };

    reader.onerror = () => {
      setCsvError('Failed to read CSV file');
    };

    reader.readAsText(file);
  };

  const handleSubmit = async (useBulk: boolean = false) => {
    // Validation
    if (!formData.target_webhook_url.trim()) {
      toast({
        title: "Validation Error",
        description: "Target webhook URL is required",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    try {
      new URL(formData.target_webhook_url);
    } catch {
      toast({
        title: "Validation Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    if (formData.product_types.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one product type is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.zip_codes.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one zip code is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Auto-generate webhook ID if empty
      const targetWebhookId = formData.target_webhook_id.trim() ||
        `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const endpoint = useBulk
        ? `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-rules/bulk`
        : `https://api.homeprojectpartners.com/webhook/${webhookId}/forwarding-rules`;

      const requestBody = useBulk
        ? {
            target_webhook_id: targetWebhookId,
            target_webhook_url: formData.target_webhook_url,
            product_types: formData.product_types,
            zip_codes_csv: formData.zip_codes.join(','),
            priority: formData.priority,
            forward_enabled: formData.forward_enabled,
            notes: formData.notes || undefined,
          }
        : {
            target_webhook_id: targetWebhookId,
            target_webhook_url: formData.target_webhook_url,
            product_types: formData.product_types,
            zip_codes: formData.zip_codes,
            priority: formData.priority,
            forward_enabled: formData.forward_enabled,
            notes: formData.notes || undefined,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Forwarding rule created successfully with ${data.rule.zip_count} zip codes`,
        });
        onSuccess();
        onOpenChange(false);
        // Reset form
        setFormData({
          target_webhook_id: '',
          target_webhook_url: '',
          product_types: [],
          zip_codes: [],
          priority: 1,
          forward_enabled: true,
          notes: '',
        });
        setCsvFile(null);
        setCsvPreview([]);
        setZipCodesText('');
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create forwarding rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating forwarding rule:', error);
      toast({
        title: "Error",
        description: "Failed to connect to API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Lead Forwarding Rule</DialogTitle>
          <DialogDescription>
            Configure automatic forwarding criteria for incoming leads from webhook: <strong>{webhookId}</strong>
          </DialogDescription>

          {/* Quick Action: Catch-All Template */}
          <Alert className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="text-sm">
                <strong>Quick Start:</strong> Create a catch-all rule to forward leads that don't match other rules
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fillCatchAllTemplate}
                className="ml-4 shrink-0"
              >
                <Zap className="h-4 w-4 mr-1" />
                Use Catch-All Template
              </Button>
            </AlertDescription>
          </Alert>
        </DialogHeader>

        <div className="space-y-6">
          {/* Target Webhook Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Target Webhook</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target_webhook_url">Target Webhook URL *</Label>
                <Input
                  id="target_webhook_url"
                  type="url"
                  placeholder="https://api.example.com/webhook/..."
                  value={formData.target_webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_webhook_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  The URL where leads will be forwarded via HTTP POST
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_webhook_id">
                  Target Webhook ID <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="target_webhook_id"
                  placeholder="e.g., partner-webhook_ws_us_solar_001"
                  value={formData.target_webhook_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_webhook_id: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Internal label for identifying this target (auto-generated if left empty)
                </p>
              </div>
            </div>
          </div>

          {/* Product Types Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Product Types *</h3>
            <div className="flex gap-2">
              <Select value={newProductType} onValueChange={handleAddProductType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product types..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map(type => (
                    <SelectItem key={type} value={type} disabled={formData.product_types.includes(type)}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.product_types.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.product_types.map(type => (
                  <Badge
                    key={type}
                    variant={type === '*' ? 'default' : 'secondary'}
                    className={`gap-1 ${type === '*' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    {type === '*' ? (
                      <><Zap className="h-3 w-3" /> All Products (Wildcard)</>
                    ) : (
                      type
                    )}
                    <button onClick={() => handleRemoveProductType(type)} className="ml-1 hover:text-destructive" title="Remove product type">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Zip Codes Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Zip Codes *</h3>
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">Single Entry</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Entry</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter zip code (e.g., 90210)"
                    value={newZipCode}
                    onChange={(e) => setNewZipCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddZipCode()}
                    maxLength={10}
                  />
                  <Button type="button" onClick={handleAddZipCode}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="bulk" className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Enter multiple zip codes (comma or newline separated)&#10;Example: 90210, 90211, 90212"
                    value={zipCodesText}
                    onChange={(e) => setZipCodesText(e.target.value)}
                    rows={6}
                  />
                  <Button type="button" onClick={handleBulkAddZipCodes}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Zip Codes
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="csv" className="space-y-4">
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Upload a CSV file containing zip codes. Zip codes can be in any column or comma-separated.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="Upload CSV file with zip codes"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {csvFile ? csvFile.name : 'Choose CSV File'}
                  </Button>

                  {csvError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{csvError}</AlertDescription>
                    </Alert>
                  )}

                  {csvPreview.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Preview: {csvPreview.join(', ')}
                        {formData.zip_codes.length > 10 && ` ... and ${formData.zip_codes.length - 10} more`}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {formData.zip_codes.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Added {formData.zip_codes.length} zip code{formData.zip_codes.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded p-2">
                  {formData.zip_codes.map(zip => (
                    <Badge
                      key={zip}
                      variant={zip === '*' ? 'default' : 'outline'}
                      className={`gap-1 font-mono text-xs ${zip === '*' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    >
                      {zip === '*' ? (
                        <><Zap className="h-3 w-3" /> All Zip Codes (Wildcard)</>
                      ) : (
                        zip
                      )}
                      <button onClick={() => handleRemoveZipCode(zip)} className="ml-1 hover:text-destructive" title="Remove zip code">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* States Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">States (Optional)</h3>
            <div className="flex gap-2">
              <Select value={newState} onValueChange={handleAddState}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select states or leave as wildcard..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(state => (
                    <SelectItem key={state} value={state} disabled={formData.states.includes(state) && formData.states[0] !== '*'}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.states.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {formData.states.includes('*')
                    ? 'Matching all states (wildcard)'
                    : `Matching ${formData.states.length} state${formData.states.length !== 1 ? 's' : ''}`}
                </p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded p-2">
                  {formData.states.map(state => (
                    <Badge
                      key={state}
                      variant={state === '*' ? 'default' : 'outline'}
                      className={`gap-1 font-mono text-xs ${state === '*' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    >
                      {state === '*' ? (
                        <><Zap className="h-3 w-3" /> All States (Wildcard)</>
                      ) : (
                        state
                      )}
                      <button onClick={() => handleRemoveState(state)} className="ml-1 hover:text-destructive" title="Remove state">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forward_enabled">Status</Label>
              <Select
                value={formData.forward_enabled.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, forward_enabled: value === 'true' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this forwarding rule..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => handleSubmit(formData.zip_codes.length > 100)} disabled={loading}>
            {loading ? 'Creating...' : 'Create Forwarding Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

