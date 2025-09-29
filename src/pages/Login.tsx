import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AnimatedLoginDoor from '@/components/AnimatedLoginDoor';
import { useEffect } from 'react';

export default function Login() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // If already authenticated, redirect to the intended page or dashboard
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleLoginSuccess = () => {
    console.log('🎉 Login successful! User:', user);
    // The AnimatedLoginDoor component handles the login logic internally
    // and calls this callback when authentication is successful
    const from = location.state?.from?.pathname || '/';
    console.log('🔄 Redirecting to:', from);
    navigate(from, { replace: true });
  };

  return <AnimatedLoginDoor onLoginSuccess={handleLoginSuccess} />;
}