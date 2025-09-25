import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string) => Promise<void>;
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
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const storedUser = localStorage.getItem('convio-auth-user');
        const loginTime = localStorage.getItem('convio-auth-time');

        if (storedUser && loginTime) {
          // Check if session is still valid (24 hours)
          const now = Date.now();
          const loginTimestamp = parseInt(loginTime, 10);
          const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

          if (now - loginTimestamp < sessionDuration) {
            setUser(storedUser);
            setIsAuthenticated(true);
          } else {
            // Session expired, clear storage
            localStorage.removeItem('convio-auth-user');
            localStorage.removeItem('convio-auth-time');
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Clear potentially corrupted data
        localStorage.removeItem('convio-auth-user');
        localStorage.removeItem('convio-auth-time');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (username: string): Promise<void> => {
    try {
      // Store user session
      localStorage.setItem('convio-auth-user', username);
      localStorage.setItem('convio-auth-time', Date.now().toString());

      setUser(username);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Failed to login');
    }
  };

  const logout = () => {
    try {
      // Clear stored session
      localStorage.removeItem('convio-auth-user');
      localStorage.removeItem('convio-auth-time');

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