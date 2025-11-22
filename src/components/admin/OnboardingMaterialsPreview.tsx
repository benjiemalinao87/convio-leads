import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Mail, FileText, Copy, Download, ExternalLink, Check } from 'lucide-react';

interface OnboardingMaterialsPreviewProps {
  data: {
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
  };
}

export function OnboardingMaterialsPreview({ data }: OnboardingMaterialsPreviewProps) {
  const { toast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedProviderId, setCopiedProviderId] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);

      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else if (type === 'provider_id') {
        setCopiedProviderId(true);
        setTimeout(() => setCopiedProviderId(false), 2000);
      } else if (type === 'webhook_url') {
        setCopiedWebhookUrl(true);
        setTimeout(() => setCopiedWebhookUrl(false), 2000);
      }

      toast({
        title: 'Copied!',
        description: `${type.replace('_', ' ')} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const downloadSetupGuide = () => {
    if (!data.setup_guide_html) return;

    const blob = new Blob([data.setup_guide_html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.company_name.replace(/[^a-z0-9]/gi, '_')}_API_Setup_Guide.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded!',
      description: 'Setup guide downloaded successfully',
    });
  };

  const openSetupGuideInNewTab = () => {
    if (!data.setup_guide_html) return;

    const blob = new Blob([data.setup_guide_html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const printSetupGuide = () => {
    if (!data.setup_guide_html) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(data.setup_guide_html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-green-600" />
          Onboarding Materials
        </CardTitle>
        <CardDescription>
          Share these materials with {data.contact_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Credentials Display */}
        <div className="space-y-3 mb-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-sm text-green-900 dark:text-green-100">
            ✅ Successfully Created
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Provider ID</div>
                <div className="font-mono text-sm truncate">{data.provider_id}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(data.provider_id, 'provider_id')}
              >
                {copiedProviderId ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Webhook URL</div>
                <div className="font-mono text-xs truncate">{data.webhook_url}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(data.webhook_url, 'webhook_url')}
              >
                {copiedWebhookUrl ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email Template
            </TabsTrigger>
            <TabsTrigger value="setup">
              <FileText className="h-4 w-4 mr-2" />
              Setup Guide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Email Template</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(data.email_template || '', 'email')}
                >
                  {copiedEmail ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Email
                    </>
                  )}
                </Button>
              </div>

              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                  {data.email_template}
                </pre>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800 text-xs">
                  <strong>To:</strong> {data.contact_email}<br />
                  <strong>Subject:</strong> Welcome to Home Project Partners - Lead API Setup
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="setup" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">HTML Setup Guide</Label>
              <p className="text-xs text-muted-foreground">
                Download the comprehensive setup guide as HTML or open it in a new tab to save as PDF
              </p>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  onClick={downloadSetupGuide}
                  className="w-full justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download HTML
                </Button>

                <Button
                  variant="outline"
                  onClick={openSetupGuideInNewTab}
                  className="w-full justify-start"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>

                <Button
                  variant="outline"
                  onClick={printSetupGuide}
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Print as PDF
                </Button>
              </div>

              {/* Preview of setup guide */}
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 text-xs font-medium">Preview</div>
                <div className="max-h-96 overflow-auto">
                  <iframe
                    srcDoc={data.setup_guide_html}
                    className="w-full h-96 border-0"
                    title="Setup Guide Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary Card */}
        <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">Next Steps</h4>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Copy the email template and send it to {data.contact_email}</li>
            <li>Download or print the HTML setup guide for the provider</li>
            <li>Provider can test their integration immediately using the credentials</li>
            <li>Monitor lead submissions in the dashboard</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper Label component if not available
function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  );
}
