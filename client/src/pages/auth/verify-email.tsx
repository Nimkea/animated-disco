import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  const verifyEmailMutation = useMutation({
    mutationFn: async (verificationToken: string) => {
      const res = await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verificationToken }),
      });
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: 'Email Verified!',
        description: 'Your email has been successfully verified. Redirecting to dashboard...',
      });
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    },
    onError: (error: any) => {
      const message = error?.message || 'Verification failed. Please try again.';
      toast({
        title: 'Verification Failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    // Extract token from URL
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (tokenParam) {
      setToken(tokenParam);
      // Auto-verify when token is present
      verifyEmailMutation.mutate(tokenParam);
    }
  }, []);

  const handleResendVerification = () => {
    setLocation('/auth?tab=register&resend=true');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      {/* Cosmic background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black" />
        <div className="stars" />
        <div className="twinkling" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-amber-500/20 bg-black/80 backdrop-blur-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4">
            {verifyEmailMutation.isPending && <Loader2 className="w-8 h-8 text-black animate-spin" />}
            {verifyEmailMutation.isSuccess && <CheckCircle2 className="w-8 h-8 text-black" />}
            {verifyEmailMutation.isError && <XCircle className="w-8 h-8 text-black" />}
            {!token && <Mail className="w-8 h-8 text-black" />}
          </div>
          
          <CardTitle className="text-2xl font-bold text-amber-500">
            {verifyEmailMutation.isPending && 'Verifying Email...'}
            {verifyEmailMutation.isSuccess && 'Email Verified!'}
            {verifyEmailMutation.isError && 'Verification Failed'}
            {!token && 'Email Verification'}
          </CardTitle>
          
          <CardDescription className="text-gray-400">
            {verifyEmailMutation.isPending && 'Please wait while we verify your email address.'}
            {verifyEmailMutation.isSuccess && 'Your email has been successfully verified. You can now access all features.'}
            {verifyEmailMutation.isError && 'We couldn\'t verify your email. The link may be expired or invalid.'}
            {!token && 'No verification token found. Please check your email for the verification link.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {verifyEmailMutation.isSuccess && (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">Redirecting to dashboard...</p>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500" />
            </div>
          )}

          {(verifyEmailMutation.isError || !token) && (
            <div className="space-y-3">
              <Button
                onClick={handleResendVerification}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                data-testid="button-resend-verification"
              >
                <Mail className="w-4 h-4 mr-2" />
                Resend Verification Email
              </Button>
              
              <Button
                onClick={() => setLocation('/auth')}
                variant="outline"
                className="w-full border-amber-500/30 hover:bg-amber-500/10 text-amber-500"
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
