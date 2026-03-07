import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';

const VerifyEmailPage: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationSuccessful, setVerificationSuccessful] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      // Extract token from URL
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');

      if (!token) {
        setIsVerifying(false);
        setVerificationSuccessful(false);
        setErrorMessage('Verification token is missing. Please check your email link.');
        return;
      }

      try {
        // Call the API endpoint to verify the email
        // First try the GET endpoint which takes a query parameter
        let response = await apiRequest('GET', `/api/verify-email?token=${token}`);
        
        // If GET fails, try the POST endpoint which takes the token in the URL
        if (!response.ok) {
          console.log('GET verification failed, trying POST endpoint');
          response = await apiRequest('POST', `/api/verify-email/${token}`);
        }
        
        const data = await response.json() as { success: boolean; message: string };
        
        if (response.ok && data.success) {
          setVerificationSuccessful(true);
          toast({
            title: "Success",
            description: data.message || "Your email has been verified successfully!",
            variant: "default",
          });
          
          // Directly update the email verification status in the query cache
          queryClient.setQueryData(["/api/user"], (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              isEmailVerified: true
            };
          });
          
          // Also refetch to ensure consistency
          await refetchUser();
        } else {
          setVerificationSuccessful(false);
          setErrorMessage(data.message || "Email verification failed. The token may be invalid or expired.");
          toast({
            title: "Error",
            description: data.message || "Email verification failed. The token may be invalid or expired.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        setVerificationSuccessful(false);
        setErrorMessage("An unexpected error occurred. Please try again later.");
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [setLocation, toast, refetchUser]);

  const handleNavigate = () => {
    setLocation(verificationSuccessful ? '/dashboard' : '/auth');
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isVerifying ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : verificationSuccessful ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="h-12 w-12 text-red-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isVerifying 
              ? "Verifying Your Email" 
              : verificationSuccessful 
                ? "Email Verified!" 
                : "Verification Failed"}
          </CardTitle>
          <CardDescription>
            {isVerifying 
              ? "Please wait while we verify your email address..."
              : verificationSuccessful
                ? "Your email has been verified successfully."
                : "We couldn't verify your email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isVerifying && !verificationSuccessful && errorMessage && (
            <div className="text-center text-red-500 mb-4">
              {errorMessage}
            </div>
          )}
          {!isVerifying && verificationSuccessful && (
            <p className="text-center text-muted-foreground mb-4">
              You can now fully use all features of the platform.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {!isVerifying && (
            <Button 
              onClick={handleNavigate}
              className="w-full"
            >
              {verificationSuccessful ? 'Go to Dashboard' : 'Back to Login'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;