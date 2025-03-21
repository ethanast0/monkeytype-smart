
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { useToast } from '../hooks/use-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const { login, isLoading, resendConfirmationEmail, signInWithAuth0 } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowResendOption(false);
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    
    try {
      await login(email, password);
      toast({
        title: "Success",
        description: "You've been logged in successfully!",
      });
      navigate('/');
    } catch (error: any) {
      console.error("Login error:", error);
      
      // Handle specific error cases
      if (error.code === "email_not_confirmed") {
        setError("Email not confirmed. Please check your inbox and confirm your email to log in.");
        setShowResendOption(true);
      } else {
        setError(error.message || "Invalid email or password. Please try again.");
      }
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
        title: "Email Sent",
        description: "A new confirmation email has been sent. Please check your inbox.",
      });
    } catch (error: any) {
      setError(error.message || "Failed to resend confirmation email. Please try again.");
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleAuth0Login = async () => {
    try {
      await signInWithAuth0();
    } catch (error: any) {
      console.error("Auth0 login error:", error);
      setError("Failed to login with Auth0. Please try again.");
    }
  };

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
                  {isResendingEmail ? "Sending..." : "Resend confirmation email"}
                </Button>
              </div>
            )}
            
            <div className="space-y-4">
              <Button 
                type="button" 
                onClick={handleAuth0Login}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Continue with Auth0"}
              </Button>
              
              <div className="relative flex items-center">
                <Separator className="flex-1" />
                <span className="mx-2 text-xs text-monkey-subtle">OR</span>
                <Separator className="flex-1" />
              </div>
            
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm text-monkey-subtle">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-monkey-subtle">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-monkey-accent hover:bg-monkey-accent/90 text-slate-900"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </div>
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
