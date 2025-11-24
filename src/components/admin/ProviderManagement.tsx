import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Alert, AlertDescription } from '../ui/alert'
import { Separator } from '../ui/separator'
import { toast } from '../ui/use-toast'
import { Loader2, Plus, Edit2, Trash2, AlertCircle, CheckCircle2, Copy } from 'lucide-react'

interface Provider {
  id: number
  provider_id: string
  provider_name: string
  company_name?: string
  contact_email?: string
  contact_name?: string
  contact_phone?: string
  is_active: boolean
  allowed_webhooks?: string[] | null
  rate_limit: number
  notes?: string
  created_at: string
  updated_at: string
  last_used_at?: string
}

interface CreateProviderData {
  provider_name: string
  company_name?: string
  contact_email?: string
  contact_name?: string
  contact_phone?: string
  notes?: string
  allowed_webhooks?: string[]
  rate_limit?: number
}

const WEBHOOK_API_BASE = 'https://api.homeprojectpartners.com'

export function ProviderManagement() {
  const { user } = useAuth()
  const isAdminOrDev = user?.permission_type === 'admin' || user?.permission_type === 'dev'

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<CreateProviderData>({
    provider_name: '',
    company_name: '',
    contact_email: '',
    contact_name: '',
    contact_phone: '',
    notes: '',
    rate_limit: 1000
  })

  // Preview generated ID
  const [previewId, setPreviewId] = useState<string>('')

  useEffect(() => {
    fetchProviders()
  }, [])

  // Generate preview ID when provider name changes
  useEffect(() => {
    if (formData.provider_name.trim()) {
      generatePreviewId(formData.provider_name)
    } else {
      setPreviewId('')
    }
  }, [formData.provider_name])

  const fetchProviders = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${WEBHOOK_API_BASE}/providers`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch providers')
      }

      setProviders(data.providers || [])
    } catch (error) {
      console.error('Error fetching providers:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch providers')
    } finally {
      setLoading(false)
    }
  }

  const generatePreviewId = async (providerName: string) => {
    try {
      const response = await fetch(`${WEBHOOK_API_BASE}/providers/test-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider_name: providerName })
      })

      const data = await response.json()
      if (response.ok) {
        setPreviewId(data.generated_id)
      }
    } catch (error) {
      console.error('Error generating preview ID:', error)
    }
  }

  const createProvider = async () => {
    if (!formData.provider_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Provider name is required",
        variant: "destructive"
      })
      return
    }

    try {
      setCreating(true)

      const response = await fetch(`${WEBHOOK_API_BASE}/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create provider')
      }

      toast({
        title: "Success",
        description: `Provider ${data.provider.provider_id} created successfully`,
      })

      // Reset form and close dialog
      setFormData({
        provider_name: '',
        company_name: '',
        contact_email: '',
        contact_name: '',
        contact_phone: '',
        notes: '',
        rate_limit: 1000
      })
      setIsCreateDialogOpen(false)

      // Refresh providers list
      await fetchProviders()

    } catch (error) {
      console.error('Error creating provider:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create provider',
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  const updateProvider = async () => {
    if (!editingProvider) return

    try {
      setUpdating(true)

      const response = await fetch(`${WEBHOOK_API_BASE}/providers/${editingProvider.provider_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update provider')
      }

      toast({
        title: "Success",
        description: `Provider ${editingProvider.provider_id} updated successfully`,
      })

      setIsEditDialogOpen(false)
      setEditingProvider(null)

      // Refresh providers list
      await fetchProviders()

    } catch (error) {
      console.error('Error updating provider:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update provider',
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const deleteProvider = async (providerId: string) => {
    if (!confirm(`Are you sure you want to delete provider ${providerId}? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(providerId)

      const response = await fetch(`${WEBHOOK_API_BASE}/providers/${providerId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete provider')
      }

      toast({
        title: "Success",
        description: `Provider ${providerId} deleted successfully`,
      })

      // Refresh providers list
      await fetchProviders()

    } catch (error) {
      console.error('Error deleting provider:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete provider',
        variant: "destructive"
      })
    } finally {
      setDeleting(null)
    }
  }

  const toggleProviderStatus = async (provider: Provider) => {
    try {
      const response = await fetch(`${WEBHOOK_API_BASE}/providers/${provider.provider_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !provider.is_active })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update provider status')
      }

      toast({
        title: "Success",
        description: `Provider ${provider.provider_id} ${!provider.is_active ? 'activated' : 'deactivated'}`,
      })

      // Refresh providers list
      await fetchProviders()

    } catch (error) {
      console.error('Error updating provider status:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update provider status',
        variant: "destructive"
      })
    }
  }

  const openEditDialog = (provider: Provider) => {
    setEditingProvider(provider)
    setFormData({
      provider_name: provider.provider_name,
      company_name: provider.company_name || '',
      contact_email: provider.contact_email || '',
      contact_name: provider.contact_name || '',
      contact_phone: provider.contact_phone || '',
      notes: provider.notes || '',
      rate_limit: provider.rate_limit
    })
    setIsEditDialogOpen(true)
  }

  const copyProviderId = (providerId: string) => {
    navigator.clipboard.writeText(providerId)
    toast({
      title: "Copied",
      description: `Provider ID ${providerId} copied to clipboard`,
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Provider Management</h2>
          <p className="text-muted-foreground">
            Manage third-party providers who can send data to webhook endpoints
          </p>
        </div>

        {isAdminOrDev && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Provider</DialogTitle>
                <DialogDescription>
                  Add a new third-party provider that can send data to webhook endpoints
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="provider-name">Provider Name *</Label>
                  <Input
                    id="provider-name"
                    placeholder="e.g., Click Ventures"
                    value={formData.provider_name}
                    onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
                  />
                  {previewId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Generated ID:</span>
                      <code className="px-2 py-1 bg-muted rounded">{previewId}</code>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g., Click Ventures LLC"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Contact Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="e.g., api@clickventures.com"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-name">Primary Contact Name (Optional)</Label>
                  <Input
                    id="contact-name"
                    type="text"
                    placeholder="e.g., John Smith"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Primary Contact Phone (Optional)</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    placeholder="e.g., +1-555-123-4567"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Rate Limit (requests/hour)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    placeholder="1000"
                    value={formData.rate_limit}
                    onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) || 1000 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Internal notes about this provider..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createProvider} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Provider
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Providers</CardTitle>
          <CardDescription>
            Third-party providers authorized to send data to webhook endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading providers...</span>
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No providers found. Create your first provider to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider ID</TableHead>
                  <TableHead>Provider Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.provider_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-muted rounded text-sm">
                          {provider.provider_id}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyProviderId(provider.provider_id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{provider.provider_name}</div>
                        {provider.contact_email && (
                          <div className="text-sm text-muted-foreground">{provider.contact_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{provider.company_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={provider.is_active ? "default" : "secondary"}>
                          {provider.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {isAdminOrDev && (
                          <Switch
                            checked={provider.is_active}
                            onCheckedChange={() => toggleProviderStatus(provider)}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {provider.last_used_at ? formatDate(provider.last_used_at) : 'Never'}
                    </TableCell>
                    <TableCell>
                      {isAdminOrDev && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(provider)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProvider(provider.provider_id)}
                            disabled={deleting === provider.provider_id}
                          >
                            {deleting === provider.provider_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>
              Update provider information for {editingProvider?.provider_id}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-provider-name">Provider Name *</Label>
              <Input
                id="edit-provider-name"
                value={formData.provider_name}
                onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-company-name">Company Name</Label>
              <Input
                id="edit-company-name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-email">Contact Email</Label>
              <Input
                id="edit-contact-email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-name">Primary Contact Name (Optional)</Label>
              <Input
                id="edit-contact-name"
                type="text"
                placeholder="e.g., John Smith"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-phone">Primary Contact Phone (Optional)</Label>
              <Input
                id="edit-contact-phone"
                type="tel"
                placeholder="e.g., +1-555-123-4567"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-rate-limit">Rate Limit (requests/hour)</Label>
              <Input
                id="edit-rate-limit"
                type="number"
                value={formData.rate_limit}
                onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) || 1000 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateProvider} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Provider
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
