import { Layout } from '@/components/dashboard/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProviderManagement } from '@/components/admin/ProviderManagement';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  Database,
  Key,
  Mail,
  Smartphone,
  Save,
  Users
} from 'lucide-react';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <User className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="providers">
              <Users className="h-4 w-4 mr-2" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="api">
              <Database className="h-4 w-4 mr-2" />
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Profile Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Admin" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" defaultValue="admin@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" defaultValue="+1 (555) 123-4567" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  System Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="UTC-8 (Pacific Time)" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Input id="dateFormat" defaultValue="MM/DD/YYYY" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input id="currency" defaultValue="USD ($)" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input id="language" defaultValue="English (US)" readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            {/* Security Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Security & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Change Password</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Last changed 30 days ago
                    </p>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Update Password
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Two-Factor Authentication</Label>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Disabled</Badge>
                      <Button variant="outline" size="sm">Enable</Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Session Management</Label>
                      <p className="text-xs text-muted-foreground">
                        View and manage your active sessions
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Manage Sessions</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">

            {/* Notification Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Email Notifications</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Receive email alerts for new leads and important updates
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Push Notifications</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Get instant notifications on your mobile device
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Lead Assignment Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Notify when new leads are assigned to you
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Weekly Reports</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive weekly performance summaries
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="providers" className="space-y-6">
            <ProviderManagement />
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            {/* API Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  API & Integrations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">API Key Management</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Generate and manage API keys for third-party integrations
                    </p>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Manage API Keys
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium">Webhook Configuration</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Configure webhook endpoints for real-time data sync
                    </p>
                    <Button variant="outline" size="sm">
                      Configure Webhooks
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium">Data Export</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Export your leads and analytics data
                    </p>
                    <Button variant="outline" size="sm">
                      Request Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
