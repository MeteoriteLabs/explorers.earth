import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

const VerificationSentPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  // Function to resend verification email
  const handleResendEmail = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to resend a verification email.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    
    try {
      // Call the API endpoint to resend verification email
      const response = await apiRequest('POST', '/api/resend-verification');
      
      const data = await response.json() as { success: boolean; message: string };
      
      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Verification email has been resent. Please check your inbox.",
          variant: "default",
        });
        await refetchUser();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to resend verification email. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <MailCheck className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We've sent a verification link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground mb-4">
            Please check your inbox and follow the link in the email to verify your account.
            If you don't see the email, check your spam folder.
          </p>

          {user?.email && (
            <div className="flex items-center justify-center py-2">
              <div className="px-4 py-2 bg-muted rounded-md text-sm font-medium break-all">
                {user.email}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            className="w-full"
            variant="outline"
            onClick={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : (
              'Resend Email'
            )}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setLocation('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerificationSentPage;