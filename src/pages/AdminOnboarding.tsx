import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileText, Mail, Loader2, CheckCircle2, X } from 'lucide-react';
import { OnboardingMaterialsPreview } from '@/components/admin/OnboardingMaterialsPreview';

interface FormData {
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  webhook_name: string;
  webhook_types: string[]; // Changed to array for multiple selection
  webhook_region: string;
  admin_email: string;
  admin_name: string;
  rate_limit: number;
}

interface OnboardingResponse {
  provider_id: string;
  webhook_id: string;
  webhook_url: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  webhook_name: string;
  webhook_type: string;
  email_template?: string;
  setup_guide_html?: string;
}

const WEBHOOK_TYPES = [
  { value: 'Solar', label: 'Solar' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'Roofing', label: 'Roofing' },
  { value: 'Windows', label: 'Windows' },
  { value: 'Bath', label: 'Bath / Bathroom' },
  { value: 'Kitchen', label: 'Kitchen' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Home Security', label: 'Home Security' },
  { value: 'General', label: 'General / Other' },
];

const US_STATES = [
  { value: 'us', label: 'United States (General)' },
  { value: 'al', label: 'Alabama' },
  { value: 'ak', label: 'Alaska' },
  { value: 'az', label: 'Arizona' },
  { value: 'ar', label: 'Arkansas' },
  { value: 'ca', label: 'California' },
  { value: 'co', label: 'Colorado' },
  { value: 'ct', label: 'Connecticut' },
  { value: 'de', label: 'Delaware' },
  { value: 'fl', label: 'Florida' },
  { value: 'ga', label: 'Georgia' },
  { value: 'hi', label: 'Hawaii' },
  { value: 'id', label: 'Idaho' },
  { value: 'il', label: 'Illinois' },
  { value: 'in', label: 'Indiana' },
  { value: 'ia', label: 'Iowa' },
  { value: 'ks', label: 'Kansas' },
  { value: 'ky', label: 'Kentucky' },
  { value: 'la', label: 'Louisiana' },
  { value: 'me', label: 'Maine' },
  { value: 'md', label: 'Maryland' },
  { value: 'ma', label: 'Massachusetts' },
  { value: 'mi', label: 'Michigan' },
  { value: 'mn', label: 'Minnesota' },
  { value: 'ms', label: 'Mississippi' },
  { value: 'mo', label: 'Missouri' },
  { value: 'mt', label: 'Montana' },
  { value: 'ne', label: 'Nebraska' },
  { value: 'nv', label: 'Nevada' },
  { value: 'nh', label: 'New Hampshire' },
  { value: 'nj', label: 'New Jersey' },
  { value: 'nm', label: 'New Mexico' },
  { value: 'ny', label: 'New York' },
  { value: 'nc', label: 'North Carolina' },
  { value: 'nd', label: 'North Dakota' },
  { value: 'oh', label: 'Ohio' },
  { value: 'ok', label: 'Oklahoma' },
  { value: 'or', label: 'Oregon' },
  { value: 'pa', label: 'Pennsylvania' },
  { value: 'ri', label: 'Rhode Island' },
  { value: 'sc', label: 'South Carolina' },
  { value: 'sd', label: 'South Dakota' },
  { value: 'tn', label: 'Tennessee' },
  { value: 'tx', label: 'Texas' },
  { value: 'ut', label: 'Utah' },
  { value: 'vt', label: 'Vermont' },
  { value: 'va', label: 'Virginia' },
  { value: 'wa', label: 'Washington' },
  { value: 'wv', label: 'West Virginia' },
  { value: 'wi', label: 'Wisconsin' },
  { value: 'wy', label: 'Wyoming' },
];

export default function AdminOnboarding() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingResponse | null>(null);

  // Verification flow state
  const [verificationStep, setVerificationStep] = useState<'form' | 'verify' | 'complete'>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const [formData, setFormData] = useState<FormData>({
    company_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    webhook_name: '',
    webhook_types: [], // Changed to array
    webhook_region: 'us',
    admin_email: '',
    admin_name: '',
    rate_limit: 5000,
  });

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('contact_phone', formatted);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const required = [
      'company_name',
      'contact_name',
      'contact_phone',
      'contact_email',
      'webhook_name',
      'admin_email'
    ];

    const missing = required.filter(field => !formData[field as keyof FormData]);

    if (missing.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return false;
    }

    if (formData.webhook_types.length === 0) {
      toast({
        title: 'Missing Webhook Types',
        description: 'Please select at least one webhook type',
        variant: 'destructive',
      });
      return false;
    }

    if (!validateEmail(formData.contact_email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid contact email address',
        variant: 'destructive',
      });
      return false;
    }

    if (!validateEmail(formData.admin_email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid admin email address',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.contact_phone.replace(/\D/g, '').length < 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  // Step 1: Request verification code (sent to Slack)
  const handleRequestVerification = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch('https://api.homeprojectpartners.com/admin/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to request verification');
      }

      // Store session ID and expiration
      setSessionId(data.session_id);
      setExpiresAt(new Date(Date.now() + data.expires_in * 1000)); // expires_in is in seconds
      setVerificationStep('verify');

      toast({
        title: 'Verification Code Sent!',
        description: 'Check Slack channel #provider-code-generation for your 6-digit code',
      });

    } catch (error) {
      console.error('Error requesting verification:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to request verification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and create provider
  const handleVerifyAndCreate = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit code from Slack',
        variant: 'destructive',
      });
      return;
    }

    if (!sessionId) {
      toast({
        title: 'Session Error',
        description: 'No active verification session. Please start over.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Verify code and create provider
      const response = await fetch('https://api.homeprojectpartners.com/admin/verify-and-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          verification_code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to verify and create provider');
      }

      // Fetch onboarding materials
      const materialsResponse = await fetch(
        `https://api.homeprojectpartners.com/admin/onboarding-materials/${data.data.provider.provider_id}`
      );

      const materialsData = await materialsResponse.json();

      if (!materialsData.success) {
        throw new Error('Failed to generate onboarding materials');
      }

      // Set onboarding data for preview
      setOnboardingData({
        provider_id: data.data.provider.provider_id,
        webhook_id: data.data.webhook.webhook_id,
        webhook_url: data.data.webhook.webhook_url,
        company_name: formData.company_name,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        webhook_name: formData.webhook_name,
        webhook_type: formData.webhook_types.join(', '),
        email_template: materialsData.email_template,
        setup_guide_html: materialsData.setup_guide_html,
      });

      setVerificationStep('complete');

      toast({
        title: 'Success!',
        description: 'Provider and webhook created successfully',
      });

    } catch (error) {
      console.error('Error verifying and creating:', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Failed to verify code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      webhook_name: '',
      webhook_types: [],
      webhook_region: 'us',
      admin_email: '',
      admin_name: '',
      rate_limit: 5000,
    });
    setOnboardingData(null);
    setVerificationStep('form');
    setVerificationCode('');
    setSessionId(null);
    setExpiresAt(null);
  };

  const handleBackToForm = () => {
    setVerificationStep('form');
    setVerificationCode('');
    setSessionId(null);
    setExpiresAt(null);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Provider Onboarding Portal</h1>
        <p className="text-muted-foreground">
          Create new provider accounts and generate onboarding materials
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Provider Information Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Provider Information
            </CardTitle>
            <CardDescription>
              Enter the provider's details to create their account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                placeholder="Enter company name"
                value={formData.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                disabled={loading || !!onboardingData}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Person</Label>
              <Input
                id="contact_name"
                placeholder="Enter contact person name"
                value={formData.contact_name}
                onChange={(e) => handleInputChange('contact_name', e.target.value)}
                disabled={loading || !!onboardingData}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone Number</Label>
              <Input
                id="contact_phone"
                placeholder="(555) 123-4567"
                value={formData.contact_phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                disabled={loading || !!onboardingData}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Email Address</Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="contact@example.com"
                value={formData.contact_email}
                onChange={(e) => handleInputChange('contact_email', e.target.value)}
                disabled={loading || !!onboardingData}
              />
            </div>

            <div className="border-t pt-4 mt-6">
              <h3 className="font-semibold mb-4">Webhook Configuration</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook_name">Webhook Name</Label>
                  <Input
                    id="webhook_name"
                    placeholder="e.g., Solar Leads California"
                    value={formData.webhook_name}
                    onChange={(e) => handleInputChange('webhook_name', e.target.value)}
                    disabled={loading || !!onboardingData}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook_types">Webhook Types (Multiple Selection)</Label>

                  {/* Display selected types as badges */}
                  {formData.webhook_types.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
                      {formData.webhook_types.map((type) => {
                        const typeLabel = WEBHOOK_TYPES.find(t => t.value === type)?.label || type;
                        return (
                          <Badge key={type} variant="secondary" className="gap-1">
                            {typeLabel}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  webhook_types: prev.webhook_types.filter(t => t !== type)
                                }));
                              }}
                              disabled={loading || !!onboardingData}
                              className="ml-1 hover:bg-destructive/20 rounded-full"
                              aria-label={`Remove ${typeLabel}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !formData.webhook_types.includes(value)) {
                        setFormData(prev => ({
                          ...prev,
                          webhook_types: [...prev.webhook_types, value]
                        }));
                      }
                    }}
                    disabled={loading || !!onboardingData}
                  >
                    <SelectTrigger id="webhook_types">
                      <SelectValue placeholder="Select webhook types to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBHOOK_TYPES.map((type) => (
                        <SelectItem
                          key={type.value}
                          value={type.value}
                          disabled={formData.webhook_types.includes(type.value)}
                        >
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook_region">Webhook Region</Label>
                  <Select
                    value={formData.webhook_region}
                    onValueChange={(value) => handleInputChange('webhook_region', value)}
                    disabled={loading || !!onboardingData}
                  >
                    <SelectTrigger id="webhook_region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate_limit">Rate Limit (requests/hour)</Label>
                  <Input
                    id="rate_limit"
                    type="number"
                    placeholder="5000"
                    value={formData.rate_limit}
                    onChange={(e) => handleInputChange('rate_limit', parseInt(e.target.value) || 5000)}
                    disabled={loading || !!onboardingData}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-6">
              <h3 className="font-semibold mb-4">Admin Information</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin_email">Admin Email</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    placeholder="yourname@buyerfound.ai"
                    value={formData.admin_email}
                    onChange={(e) => handleInputChange('admin_email', e.target.value)}
                    disabled={loading || !!onboardingData}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_name">Admin Name (Optional)</Label>
                  <Input
                    id="admin_name"
                    placeholder="Your name"
                    value={formData.admin_name}
                    onChange={(e) => handleInputChange('admin_name', e.target.value)}
                    disabled={loading || !!onboardingData}
                  />
                </div>
              </div>
            </div>

            {/* Verification Step UI */}
            {verificationStep === 'verify' && !onboardingData && (
              <div className="border-t pt-6 mt-6">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Verification Code Sent!
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Check Slack channel <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">#provider-code-generation</span> for your 6-digit verification code.
                      </p>
                      {expiresAt && (
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                          ⏰ Code expires at {expiresAt.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification_code">Enter Verification Code</Label>
                    <Input
                      id="verification_code"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest font-mono"
                      disabled={loading}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Enter the 6-digit code from Slack
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleVerifyAndCreate}
                      disabled={loading || verificationCode.length !== 6}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Verify & Create Provider
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleBackToForm}
                      variant="outline"
                      disabled={loading}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Form Submission Buttons */}
            {verificationStep === 'form' && (
              <div className="flex gap-3 pt-4">
                {!onboardingData ? (
                  <>
                    <Button
                      onClick={handleRequestVerification}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Verification Code
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleClearForm}
                      variant="outline"
                      disabled={loading}
                    >
                      Clear
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleClearForm}
                    variant="outline"
                    className="flex-1"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Another Provider
                  </Button>
                )}
              </div>
            )}

            {/* Completion State */}
            {verificationStep === 'complete' && onboardingData && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleClearForm}
                  variant="outline"
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Another Provider
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Email Preview / Materials */}
        {onboardingData ? (
          <OnboardingMaterialsPreview data={onboardingData} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preview
              </CardTitle>
              <CardDescription>
                Materials will appear here after generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Mail className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Materials Generated</h3>
                <p className="text-muted-foreground max-w-sm">
                  Fill in the form and click "Generate Materials" to preview your email template and setup guide
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
