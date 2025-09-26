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
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateRoutingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  workspace_id: string;
  product_types: string[];
  zip_codes: string[];
  priority: number;
  notes: string;
  is_active: boolean;
}

// Available workspaces - in a real app, this would come from an API
const WORKSPACES = [
  { id: 'default_workspace', name: 'Default Workspace' },
  { id: 'demo_sales_team', name: 'Demo Sales Team' },
  { id: 'hvac_specialists', name: 'HVAC Specialists Team' },
  { id: 'test_team_001', name: 'Test Team for API Demo' },
];

// Available product types
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
];

export function CreateRoutingRuleDialog({ open, onOpenChange, onSuccess }: CreateRoutingRuleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<FormData>({
    workspace_id: '',
    product_types: [],
    zip_codes: [],
    priority: 1,
    notes: '',
    is_active: true,
  });

  const [newProductType, setNewProductType] = useState('');
  const [newZipCode, setNewZipCode] = useState('');
  const [zipCodesText, setZipCodesText] = useState('');

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
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (zipRegex.test(newZipCode)) {
        setFormData(prev => ({
          ...prev,
          zip_codes: [...prev.zip_codes, newZipCode]
        }));
        setNewZipCode('');
      } else {
        toast({
          title: "Invalid Zip Code",
          description: "Please enter a valid US zip code (e.g., 12345 or 12345-6789)",
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveZipCode = (zipCode: string) => {
    setFormData(prev => ({
      ...prev,
      zip_codes: prev.zip_codes.filter(zip => zip !== zipCode)
    }));
  };

  const handleBulkZipCodes = () => {
    if (!zipCodesText.trim()) return;

    const zipCodes = zipCodesText
      .split(/[,\n\r]+/)
      .map(zip => zip.trim())
      .filter(zip => zip.length > 0);

    const validZips: string[] = [];
    const invalidZips: string[] = [];
    const zipRegex = /^\d{5}(-\d{4})?$/;

    zipCodes.forEach(zip => {
      if (zipRegex.test(zip)) {
        if (!formData.zip_codes.includes(zip)) {
          validZips.push(zip);
        }
      } else {
        invalidZips.push(zip);
      }
    });

    if (invalidZips.length > 0) {
      toast({
        title: "Invalid Zip Codes Found",
        description: `${invalidZips.length} invalid zip codes were skipped: ${invalidZips.slice(0, 3).join(', ')}${invalidZips.length > 3 ? '...' : ''}`,
        variant: "destructive",
      });
    }

    if (validZips.length > 0) {
      setFormData(prev => ({
        ...prev,
        zip_codes: [...prev.zip_codes, ...validZips]
      }));
      setZipCodesText('');
      toast({
        title: "Success",
        description: `Added ${validZips.length} zip codes`,
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setCsvError('');

    // Read and preview the file
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 5); // Preview first 5 lines
      const zipCodes = lines
        .join(',')
        .split(',')
        .map(zip => zip.trim())
        .filter(zip => zip.length > 0)
        .slice(0, 10); // Show first 10 zip codes

      setCsvPreview(zipCodes);
    };
    reader.readAsText(file);
  };

  const handleUploadCsv = async () => {
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvData = e.target?.result as string;

      try {
        const response = await fetch('https://api.homeprojectpartners.com/routing-rules/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: formData.workspace_id,
            product_types: formData.product_types,
            zip_codes_csv: csvData.replace(/\r?\n/g, ','), // Convert newlines to comma-separated
            priority: formData.priority,
            is_active: formData.is_active,
            notes: formData.notes,
          }),
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Success",
            description: `Routing rule created with ${data.rule.zip_count} zip codes`,
          });
          onSuccess();
          handleClose();
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to create routing rule",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error creating routing rule:', error);
        toast({
          title: "Error",
          description: "Failed to connect to API",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(csvFile);
  };

  const handleSubmit = async () => {
    if (!formData.workspace_id) {
      toast({
        title: "Validation Error",
        description: "Please select a workspace",
        variant: "destructive",
      });
      return;
    }

    if (formData.product_types.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one product type",
        variant: "destructive",
      });
      return;
    }

    if (formData.zip_codes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one zip code",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('https://api.homeprojectpartners.com/routing-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Routing rule created successfully",
        });
        onSuccess();
        handleClose();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create routing rule",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating routing rule:', error);
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
    setFormData({
      workspace_id: '',
      product_types: [],
      zip_codes: [],
      priority: 1,
      notes: '',
      is_active: true,
    });
    setNewProductType('');
    setNewZipCode('');
    setZipCodesText('');
    setCsvFile(null);
    setCsvError('');
    setCsvPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const downloadSampleCsv = () => {
    const sampleData = "90210,90211,90212\n10001,10002,10003\n30301,30302,30303";
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-zip-codes.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Routing Rule</DialogTitle>
          <DialogDescription>
            Set up automatic routing criteria for appointments based on product type and zip codes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace *</Label>
                <Select
                  value={formData.workspace_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, workspace_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSPACES.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            {/* Product Types */}
            <div className="space-y-2">
              <Label>Product Types *</Label>
              <div className="flex gap-2">
                <Select value={newProductType} onValueChange={setNewProductType}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.filter(type => !formData.product_types.includes(type)).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => handleAddProductType(newProductType)}
                  disabled={!newProductType}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.product_types.map((type) => (
                  <Badge key={type} variant="secondary" className="flex items-center gap-1">
                    {type}
                    <button
                      onClick={() => handleRemoveProductType(type)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Zip Codes */}
          <div className="space-y-4">
            <Label>Zip Codes * ({formData.zip_codes.length} added)</Label>

            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                {/* Individual Zip Code Entry */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter zip code (e.g., 90210)"
                    value={newZipCode}
                    onChange={(e) => setNewZipCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddZipCode()}
                  />
                  <Button
                    type="button"
                    onClick={handleAddZipCode}
                    disabled={!newZipCode}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Bulk Text Entry */}
                <div className="space-y-2">
                  <Label className="text-sm">Bulk Entry (comma or line separated)</Label>
                  <Textarea
                    placeholder="90210,90211,90212 or one per line"
                    value={zipCodesText}
                    onChange={(e) => setZipCodesText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    type="button"
                    onClick={handleBulkZipCodes}
                    disabled={!zipCodesText.trim()}
                    size="sm"
                    variant="outline"
                  >
                    Add Zip Codes
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="csv" className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Upload a CSV file with zip codes. Each cell can contain a zip code.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      ref={fileInputRef}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadSampleCsv}
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Sample CSV
                    </Button>
                  </div>

                  {csvError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-600">
                        {csvError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {csvFile && csvPreview.length > 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-600">
                        <div>
                          <p className="font-medium">CSV Preview:</p>
                          <p className="text-sm mt-1">
                            {csvPreview.slice(0, 5).join(', ')}
                            {csvPreview.length > 5 && '...'}
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {csvFile && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleUploadCsv}
                        disabled={loading || !formData.workspace_id || formData.product_types.length === 0}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Create Rule with CSV Data
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCsvFile(null);
                          setCsvPreview([]);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Selected Zip Codes Display */}
            {formData.zip_codes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Selected Zip Codes ({formData.zip_codes.length})</Label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded p-2">
                  {formData.zip_codes.map((zip) => (
                    <Badge key={zip} variant="outline" className="flex items-center gap-1 font-mono text-xs">
                      {zip}
                      <button
                        onClick={() => handleRemoveZipCode(zip)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional description for this routing rule"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.workspace_id || formData.product_types.length === 0 || formData.zip_codes.length === 0}
          >
            {loading ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}