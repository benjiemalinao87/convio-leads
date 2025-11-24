import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Lock, User, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AnimatedLoginDoorProps {
  onLoginSuccess: () => void;
}

export default function AnimatedLoginDoor({ onLoginSuccess }: AnimatedLoginDoorProps) {
  const { login } = useAuth();
  const [loginType, setLoginType] = useState<'standard' | 'provider'>('standard');
  const [email, setEmail] = useState('');
  const [providerId, setProviderId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [doorState, setDoorState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [showParticles, setShowParticles] = useState(false);

  // Auto-open door after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setDoorState('opening');
      setShowParticles(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle door opening completion
  useEffect(() => {
    if (doorState === 'opening') {
      const timer = setTimeout(() => {
        setDoorState('open');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [doorState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validation
      if (!email.trim()) {
        setError('Email or username is required');
        setIsLoading(false);
        return;
      }

      if (loginType === 'provider' && !providerId.trim()) {
        setError('Provider ID is required');
        setIsLoading(false);
        return;
      }

      if (!password.trim()) {
        setError('Password is required');
        setIsLoading(false);
        return;
      }

      // Authenticate with backend API
      setDoorState('closing');

      setTimeout(async () => {
        try {
          await login(
            email.trim(), 
            password,
            loginType === 'provider' ? providerId.trim() : undefined
          );
          onLoginSuccess();
        } catch (loginError) {
          const errorMessage = loginError instanceof Error ? loginError.message : 'Authentication failed';
          setError(errorMessage);
          setDoorState('open');
          setIsLoading(false);
        }
      }, 800);
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated particles background */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full particle-float"
              style={{
                // eslint-disable-next-line react/forbid-dom-props
                left: `${Math.random() * 100}%`,
                // eslint-disable-next-line react/forbid-dom-props
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-md space-y-8 relative z-10">

        {/* Door Container with 3D Perspective */}
        <div className="relative door-perspective">
          {/* Left Door Panel */}
          <div
            className={`absolute inset-y-0 left-0 w-1/2 door-panel door-panel-left ${doorState === 'closed'
                ? 'door-left-closed'
                : doorState === 'opening'
                  ? 'door-left-opening'
                  : doorState === 'open'
                    ? 'door-left-open'
                    : 'door-left-closing'
              }`}
          >
            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border-r border-primary/30 rounded-l-lg flex items-center justify-center">
              <div className="text-center space-y-6 p-8">
                <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center shadow-lg">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-primary mb-3">Appointment Routing Algorithm</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Right Door Panel */}
          <div
            className={`absolute inset-y-0 right-0 w-1/2 door-panel door-panel-right ${doorState === 'closed'
                ? 'door-right-closed'
                : doorState === 'opening'
                  ? 'door-right-opening'
                  : doorState === 'open'
                    ? 'door-right-open'
                    : 'door-right-closing'
              }`}
          >
            <div className="h-full w-full bg-gradient-to-bl from-accent/20 to-accent/5 backdrop-blur-sm border-l border-accent/30 rounded-r-lg flex items-center justify-center">
              <div className="text-center space-y-6 p-8">
                <div className="w-16 h-16 mx-auto bg-accent/20 rounded-full flex items-center justify-center shadow-lg">
                  <User className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-accent mb-3">Secured Access</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Login Form (Behind the doors) */}
          <Card
            className={`relative glass-card transition-all duration-700 shadow-2xl border-0 ${doorState === 'open' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            style={{
              transform: doorState === 'open' ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            <CardHeader className="space-y-2 pb-6">
              <CardTitle className="text-2xl text-center font-semibold">Authentication Required</CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                Please sign in to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Login Type Toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('standard');
                      setProviderId('');
                      setError('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      loginType === 'standard'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Admin/Dev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('provider');
                      setError('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      loginType === 'provider'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Provider
                  </button>
                </div>

                {/* Provider ID Field (only for provider login) */}
                {loginType === 'provider' && (
                  <div className="space-y-2">
                    <Label htmlFor="providerId" className="text-sm font-medium text-foreground">
                      Provider ID
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="providerId"
                        type="text"
                        placeholder="Enter your provider ID"
                        value={providerId}
                        onChange={(e) => setProviderId(e.target.value)}
                        className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        disabled={isLoading}
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {/* Email/Username Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email / Username
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter your email or username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      disabled={isLoading}
                      autoComplete="username"
                      autoFocus={loginType === 'standard'}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-background/50 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <LogIn className="w-5 h-5" />
                      <span>Sign In</span>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground/80">
          <p className="font-medium">Buyerfound</p>
          <p className="text-xs mt-1">Professional Lead Management Platform</p>
        </div>
      </div>
    </div>
  );
}
