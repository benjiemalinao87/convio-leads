import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'
import { Copy, CheckCircle2, Code, ExternalLink } from 'lucide-react'
import { toast } from '../ui/use-toast'

interface ProviderFormEmbedProps {
  providerId: string
  providerName: string
}

export function ProviderFormEmbed({ providerId, providerName }: ProviderFormEmbedProps) {
  const [copied, setCopied] = useState(false)
  const [height, setHeight] = useState('800')
  const [width, setWidth] = useState('100%')

  const baseUrl = 'https://app.buyerfound.ai'
  const formUrl = `${baseUrl}/form?provider_id=${providerId}`

  const iframeCode = `<iframe 
  src="${formUrl}" 
  width="${width}" 
  height="${height}" 
  frameborder="0" 
  style="border: none; width: 100%; max-width: 100%;">
</iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Embed code copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive"
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <CardTitle>Embeddable Form</CardTitle>
        </div>
        <CardDescription>
          Embed this form on your website to collect leads and appointments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form URL */}
        <div className="space-y-2">
          <Label>Form URL</Label>
          <div className="flex gap-2">
            <Input value={formUrl} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(formUrl, '_blank')}
              title="Open form in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Customization Options */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <Label className="text-base font-semibold">Customization (Optional)</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="iframe-width">Width</Label>
              <Input
                id="iframe-width"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="100%"
              />
              <p className="text-xs text-muted-foreground">
                e.g., 100%, 800px, 100vw
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="iframe-height">Height</Label>
              <Input
                id="iframe-height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="800"
              />
              <p className="text-xs text-muted-foreground">
                e.g., 800, 800px, 100vh
              </p>
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Embed Code</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Code
                </>
              )}
            </Button>
          </div>
          <div className="relative">
            <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs font-mono border">
              <code>{iframeCode}</code>
            </pre>
          </div>
        </div>

        {/* Instructions */}
        <Alert>
          <AlertDescription className="space-y-2">
            <p className="font-semibold">How to use:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Copy the embed code above</li>
              <li>Paste it into your website's HTML where you want the form to appear</li>
              <li>The form will automatically collect leads and optionally book appointments</li>
              <li>All submissions will be linked to your provider account: <strong>{providerName}</strong></li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Preview Link */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(formUrl, '_blank')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Preview Form
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

