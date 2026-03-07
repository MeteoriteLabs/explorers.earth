/**
 * New Auth Page - explorers.earth Auth Model
 * Login page with Google OAuth support
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Music4, Eye, EyeOff, Loader2 } from 'lucide-react';
import { MusicLoader } from '@/components/ui/music-loader';
import { useStrapiAuth } from '@/hooks/use-strapi-auth';
import { useAuthStore } from '@/stores/authStore';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

const VITE_REST_API_URL = import.meta.env.VITE_REST_API_URL || 'https://api.explorers.earth';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;

export default function NewAuthPage() {
  const { login, register, isLoading } = useStrapiAuth();
  const { isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = async (data: LoginInput) => {
    await login(data);
  };

  const handleRegister = async (data: RegisterInput) => {
    const { confirmPassword, ...registerData } = data;
    await register(registerData);
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    window.location.href = `${VITE_REST_API_URL}/connect/google`;
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Welcome to Local Tunes</CardTitle>
            <CardDescription>
              Create and manage collaborative playlists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="identifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username or Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="text" autoComplete="username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                              <Input
                                type={showLoginPassword ? 'text' : 'password'}
                                {...field}
                                autoComplete="current-password"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                            >
                              {showLoginPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <MusicLoader size="sm" className="mr-2" />
                          Logging in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </Button>
                  </form>
                </Form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <div className="space-y-4 text-center">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      To use LocalTunes, you need to connect your Explorers account
                    </p>
                    <div className="text-left space-y-2 text-xs text-muted-foreground">
                      <p><strong>New users:</strong> Create Explorers account and enable LocalTunes during signup</p>
                      <p><strong>Existing users:</strong> If you already have Explorers account, connect LocalTunes from Settings tab</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button
                      onClick={() => window.open('https://explorers.earth/register', '_blank')}
                      className="w-full"
                    >
                      Create Explorers Account
                    </Button>
                    <Button
                      onClick={() => window.open('https://explorers.earth/login', '_blank')}
                      variant="outline"
                      className="w-full"
                    >
                      Already have Explorers? Login
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center text-primary-foreground">
        <div className="max-w-md text-center">
          <Music4 className="h-20 w-20 mx-auto mb-8" />
          <h1 className="text-4xl font-bold mb-4">Local Tunes</h1>
          <p className="text-lg mb-8">
            Create collaborative playlists and share them with your guests through unique URLs.
            Perfect for venues, events, and gatherings.
          </p>
        </div>
      </div>
    </div>
  );
}
