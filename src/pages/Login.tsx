import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { clearAuthData, supabase } from '@/integrations/supabase/client';
import { authDebug, logAuthError, traceSessionCheck } from '@/utils/authDebug';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const { login, isLoading, user, resendConfirmationEmail, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sessionResetInProgress, setSessionResetInProgress] = useState(false);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const redirectedFrom = useRef(location.state?.from || '/');
  const loginAttempt = useRef(false);
  const loginStartTime = useRef<number | null>(null);
  const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckRef = useRef<boolean>(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Check if we already have a session when the component mounts
  useEffect(() => {
    const checkExistingSession = async () => {
      if (sessionCheckRef.current) return; // Only check once
      sessionCheckRef.current = true;
      
      try {
        authDebug("Login component checking for existing session");
        const { data } = await supabase.auth.getSession();
        traceSessionCheck('Login-checkExistingSession', data.session);
        
        if (data.session?.user) {
          authDebug("Login component detected active session", {
            userId: data.session.user.id,
            mountTime: mountTimeRef.current
          });
          setAlreadyLoggedIn(true);
          // Don't redirect yet - let the auth context handle that
        } else {
          authDebug("Login component did not find active session");
        }
      } catch (error) {
        logAuthError("Error checking session in Login component", error);
      }
    };
    
    checkExistingSession();
    
    // Also add a forced check a bit later to detect race conditions
    const laterCheck = setTimeout(async () => {
      try {
        authDebug("Login component running delayed session check");
        const { data } = await supabase.auth.getSession();
        
        // Compare with state
        traceSessionCheck('Login-delayedCheck', data.session);
        authDebug("Delayed check state comparison", {
          hasSession: !!data.session?.user,
          alreadyLoggedInState: alreadyLoggedIn,
          userContextState: !!user,
          timeSinceMount: Date.now() - mountTimeRef.current
        });
      } catch (error) {
        logAuthError("Error in delayed session check", error);
      }
    }, 1000);
    
    return () => {
      clearTimeout(laterCheck);
    };
  }, [user, alreadyLoggedIn]);

  // Clear any old auth errors when component mounts
  useEffect(() => {
    setError(null);
    
    // Check if we're coming back with a verified parameter
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === 'true') {
      authDebug("Login page detected verified=true parameter");
      toast({
        title: "Email Verified",
        description: "Your email has been verified. You can now log in.",
      });
      
      // Remove the parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('verified');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
    
    // Check if we're here after a reset
    if (params.get('reset') === 'true') {
      authDebug("Login page detected reset=true parameter");
      toast({
        title: "Session Reset",
        description: "Your session has been reset. Please log in again.",
      });
      
      // Remove the parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reset');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
    
    // When component unmounts, clear any pending timeouts
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }
      authDebug("Login component unmounted");
    };
  }, [location, toast]);

  // Redirect if already logged in
  useEffect(() => {
    // Add debug log to see when this effect runs
    authDebug("Login redirect effect triggered", {
      userState: !!user,
      alreadyLoggedIn,
      timeSinceMount: Date.now() - mountTimeRef.current
    });
    
    if (user) {
      authDebug("User authenticated in context, navigating to home", {
        userId: user.id,
        redirectTo: redirectedFrom.current || '/'
      });
      
      // Redirect to the page they were trying to access, or home
      navigate(redirectedFrom.current || '/');
      
      // If we had a timer running, clear it
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }
    }
  }, [user, navigate, alreadyLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If we're already detecting a session, just redirect without doing a login
    if (alreadyLoggedIn) {
      authDebug("Login form submitted but already logged in, redirecting");
      toast({
        title: "Already logged in",
        description: "You are already logged in, redirecting..."
      });
      navigate(redirectedFrom.current || '/');
      return;
    }
    
    setError(null);
    setShowResendOption(false);
    setSubmitting(true);
    loginAttempt.current = true;
    loginStartTime.current = Date.now();
    
    // Set a timeout to detect stalled login attempts
    if (loginTimeoutRef.current) {
      clearTimeout(loginTimeoutRef.current);
    }
    
    loginTimeoutRef.current = setTimeout(() => {
      // If we're still submitting after 10 seconds, something is wrong
      if (submitting && !user) {
        authDebug("Login attempt stalled after timeout");
        setError("Login attempt timed out. Your session might be in an inconsistent state. Try resetting your session.");
        setSubmitting(false);
      }
    }, 10000); // 10 second timeout
    
    if (!email || !password) {
      setError("Please fill in all fields");
      setSubmitting(false);
      return;
    }
    
    try {
      authDebug("Attempting login with email", { 
        email,
        alreadyLoggedInState: alreadyLoggedIn,
        userContextState: !!user
      });
      
      // Check if we already have a session before attempting login
      const { data: sessionData } = await supabase.auth.getSession();
      traceSessionCheck('login-precheck', sessionData.session);
      
      if (sessionData.session?.user) {
        authDebug("Found existing session before login attempt", {
          userId: sessionData.session.user.id,
          email
        });
        
        // We're already logged in, just redirect
        setAlreadyLoggedIn(true);
        navigate(redirectedFrom.current || '/');
        setSubmitting(false);
        return;
      }
      
      // Clear any lingering data before login attempt for clean state
      clearAuthData();
      
      await login(email, password);
      authDebug("Login function completed successfully");
      
      // Success will redirect via the useEffect above
    } catch (error: any) {
      logAuthError("Login error", error);
      
      // Handle specific error cases
      if (error.code === "email_not_confirmed") {
        setError("Email not confirmed. Please check your inbox and confirm your email to log in.");
        setShowResendOption(true);
      } else if (error.message && error.message.includes("network")) {
        setError("Network error. Please check your internet connection and try again.");
      } else if (error.code === "invalid_grant" || error.message?.includes("password")) {
        setError("Invalid email or password. Please try again.");
      } else if (error.message?.includes("session")) {
        setError("Session error. Try resetting your session before attempting to log in again.");
      } else if (error.message?.includes("User is already signed in")) {
        authDebug("Received 'already signed in' error during login");
        setAlreadyLoggedIn(true);
        
        // Check for session again
        try {
          const { data } = await supabase.auth.getSession();
          traceSessionCheck('login-alreadySignedIn', data.session);
          
          if (data.session?.user) {
            authDebug("Verified session exists after 'already signed in' error");
          }
        } catch (e) {
          logAuthError("Error checking session after 'already signed in'", e);
        }
        
        // Try to refresh the page to get the user state
        window.location.reload();
        return;
      } else {
        setError(error.message || "Invalid email or password. Please try again.");
      }
    } finally {
      // Clear the timeout
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
        loginTimeoutRef.current = null;
      }
      setSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setIsResendingEmail(true);
    try {
      await resendConfirmationEmail(email);
      toast({
        title: "Email sent",
        description: "Confirmation email has been sent. Please check your inbox.",
      });
    } catch (error: any) {
      setError(error.message || "Failed to resend confirmation email. Please try again.");
      logAuthError("Error resending confirmation email", error);
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Handle case where auth is in limbo (thinks logged in but can't get profile)
  const handleForceLogout = async () => {
    try {
      setSessionResetInProgress(true);
      authDebug("Force logout initiated");
      
      // First try to use the logout function for a clean logout
      if (logout) {
        try {
          await logout();
          authDebug("Clean logout successful");
        } catch (e) {
          logAuthError("Error during normal logout, proceeding with force logout", e);
        }
      }
      
      // Clear all auth data thoroughly using our helper function
      clearAuthData();
      
      // Show a toast to the user
      toast({
        title: "Session Reset",
        description: "Your session has been reset. You can now try logging in again.",
      });
      
      // Force reload the page to clear any in-memory state
      authDebug("Reloading page to complete session reset");
      setTimeout(() => {
        window.location.href = '/login?reset=true';
      }, 500);
    } catch (error) {
      logAuthError("Error during forced logout", error);
      // Last resort - redirect to login with cleared state
      window.location.href = '/login?reset=true';
    }
  };

  // If already logged in, show a simpler message
  if (alreadyLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-900">
        <Header />
        
        <main className="flex-1 container max-w-6xl mx-auto px-4 py-10 flex items-center justify-center">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                <span className="text-monkey-accent">Welcome</span> back
              </CardTitle>
              <CardDescription className="text-center text-monkey-subtle">
                You are already logged in
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <p className="text-center">
                We detected that you already have an active session.
              </p>
              
              <Button 
                onClick={() => navigate('/')}
                className="bg-monkey-accent hover:bg-monkey-accent/90 text-slate-900"
              >
                Go to Dashboard
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleForceLogout}
                className="text-red-400 hover:text-red-500 border-red-800/30"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Header />
      
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-10 flex items-center justify-center">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              <span className="text-monkey-accent">Welcome</span> back
            </CardTitle>
            <CardDescription className="text-center text-monkey-subtle">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {showResendOption && (
              <div className="mb-4 text-center">
                <Button 
                  variant="outline" 
                  className="text-monkey-accent hover:text-monkey-accent/90 border-monkey-accent/50"
                  onClick={handleResendEmail}
                  disabled={isResendingEmail}
                >
                  {isResendingEmail ? 
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </> : 
                    "Resend confirmation email"
                  }
                </Button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-monkey-subtle">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700 border-slate-600"
                  disabled={submitting || sessionResetInProgress}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-monkey-subtle">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-700 border-slate-600"
                  disabled={submitting || sessionResetInProgress}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-monkey-accent hover:bg-monkey-accent/90 text-slate-900"
                disabled={submitting || isLoading || sessionResetInProgress}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : "Login"}
              </Button>
            </form>
            
            {/* Emergency logout button - show if they've tried to log in but are stuck 
                or if there's a stalled login attempt */}
            {(loginAttempt.current && (isLoading || error?.includes("session"))) && (
              <div className="mt-4 text-center">
                <p className="text-xs text-monkey-subtle mb-2">Having trouble? Try resetting your session:</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-400 hover:text-red-500 border-red-800/30"
                  onClick={handleForceLogout}
                  disabled={sessionResetInProgress}
                >
                  {sessionResetInProgress ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      Resetting...
                    </>
                  ) : "Reset Session"}
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-center text-sm text-monkey-subtle">
              Don't have an account?{" "}
              <Link to="/signup" className="text-monkey-accent hover:underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default Login;
