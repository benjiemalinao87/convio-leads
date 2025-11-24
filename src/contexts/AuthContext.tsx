import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: number;
  email: string;
  permission_type: 'admin' | 'dev' | 'provider';
  provider_id?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string, providerId?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const storedToken = localStorage.getItem('convio-auth-token');
        const storedUserJson = localStorage.getItem('convio-auth-user');

        if (storedToken && storedUserJson) {
          // Verify token with backend
          const response = await fetch('https://api.homeprojectpartners.com/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: storedToken })
          });

          const data = await response.json();

          if (data.valid && data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
            // Update stored user in case it changed
            localStorage.setItem('convio-auth-user', JSON.stringify(data.user));
          } else {
            // Token invalid or expired, clear storage
            localStorage.removeItem('convio-auth-token');
            localStorage.removeItem('convio-auth-user');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Clear potentially corrupted data
        localStorage.removeItem('convio-auth-token');
        localStorage.removeItem('convio-auth-user');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string, providerId?: string): Promise<void> => {
    try {
      // Call backend authentication API
      const response = await fetch('https://api.homeprojectpartners.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email, 
          password,
          ...(providerId && { provider_id: providerId })
        })
      });

      const data = await response.json();

      if (data.success && data.user) {
        // Store token and user info
        localStorage.setItem('convio-auth-token', data.token);
        localStorage.setItem('convio-auth-user', JSON.stringify(data.user));

        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        throw new Error(data.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error instanceof Error ? error : new Error('Failed to login');
    }
  };

  const logout = async () => {
    try {
      // Optionally call backend logout endpoint
      const token = localStorage.getItem('convio-auth-token');
      if (token) {
        await fetch('https://api.homeprojectpartners.com/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API call fails
    }

    try {
      // Clear stored session
      localStorage.removeItem('convio-auth-token');
      localStorage.removeItem('convio-auth-user');

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even if localStorage fails
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};