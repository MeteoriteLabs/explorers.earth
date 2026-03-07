import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Music4, Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { MusicLoader } from "@/components/ui/music-loader";
import { useState, useEffect } from "react";
import { z } from "zod";
import { getCsrfToken } from "@/lib/csrf";
import { CountrySelect } from "@/components/country-select";

const extendedUserSchema = insertUserSchema.extend({
  venueName: z.string().min(1, "Venue name is required"),
  email: z.string().email("Invalid email format").optional(),
  phoneNumber: z.string().optional(),
  countryCode: z.string().optional(),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  _csrf: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ExtendedUser = z.infer<typeof extendedUserSchema>;

export default function AuthPage() {
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const [isAdmin] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('admin') === 'true';
    }
    return false;
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(insertUserSchema.pick({ username: true, password: true })),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(extendedUserSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      venueName: "",
      email: "",
      phoneNumber: "",
      countryCode: "",
    },
  });

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Use effect to refresh the token value occasionally
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  
  useEffect(() => {
    // Get initial token
    const token = getCsrfToken();
    setCsrfToken(token);
    
    // Set up a timer to refresh the token every 2 minutes
    const interval = setInterval(() => {
      const token = getCsrfToken();
      setCsrfToken(token);
    }, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // If authenticated, let ProtectedRoute handle the routing
  if (user) {
    return null;
  }

  const handleLoginSubmit = async (data: { username: string; password: string }) => {
    try {
      // Add the CSRF token to the login data
      await loginMutation.mutateAsync({
        ...data,
        _csrf: csrfToken || '',
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>{isAdmin ? "Super Admin Access" : "Welcome to Local Tunes"}</CardTitle>
            <CardDescription>
              {isAdmin ? "Secure administrative portal" : "Create and manage collaborative playlists"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
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
                              type={showLoginPassword ? "text" : "password"}
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
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <MusicLoader size="sm" className="mr-2" />
                        Authenticating...
                      </>
                    ) : (
                      'Login'
                    )}
                  </Button>
                </form>
              </Form>
            ) : (
              <Tabs defaultValue="login">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)}>
                      <div className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
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
                                    type={showLoginPassword ? "text" : "password"}
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
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <>
                              <MusicLoader size="sm" className="mr-2" />
                              Logging in...
                            </>
                          ) : (
                            'Login'
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  {/* Original signup form commented out */}
                  {/* 
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((data) => {
                      const { confirmPassword, ...registerData } = data;
                      // Add CSRF token to registration data
                      registerMutation.mutate({
                        ...registerData,
                        _csrf: csrfToken || ''
                      });
                    })}>
                      <div className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="venueName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Venue/Brand Name</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="organization" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" autoComplete="email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="countryCode"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>Country</FormLabel>
                                <FormControl>
                                  <CountrySelect 
                                    value={field.value} 
                                    onChange={(countryValue, phoneCode) => {
                                      field.onChange(phoneCode);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Enter your phone number" 
                                    type="tel"
                                    autoComplete="tel"
                                    style={{ color: 'black', backgroundColor: 'white' }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="username" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    type={showRegisterPassword ? "text" : "password"}
                                    {...field}
                                    autoComplete="new-password"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                >
                                  {showRegisterPassword ? (
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
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    type={showConfirmPassword ? "text" : "password"}
                                    {...field}
                                    autoComplete="new-password"
                                  />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                  {showConfirmPassword ? (
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
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <MusicLoader size="sm" className="mr-2" />
                              Registering...
                            </>
                          ) : (
                            'Register'
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                  */}
                  
                  {/* Redirect to external signup page */}
                  <div className="space-y-4 text-center">
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        To use LocalTunes, you need to connect your LocalQR account
                      </p>
                      <div className="text-left space-y-2 text-xs text-muted-foreground">
                        <p><strong>New users:</strong> Create LocalQR account and enable LocalTunes during signup</p>
                        <p><strong>Existing users:</strong> If you already have LocalQR account, connect LocalTunes from Settings tab</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={() => window.open('https://localqr.earth/register', '_blank')}
                        className="w-full"
                      >
                        Create LocalQR Account
                      </Button>
                      <Button
                        onClick={() => window.open('https://localqr.earth/login', '_blank')}
                        variant="outline"
                        className="w-full"
                      >
                        Already have LocalQR? Login
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center text-primary-foreground">
        <div className="max-w-md text-center">
          {isAdmin ? (
            <>
              <Shield className="h-20 w-20 mx-auto mb-8" />
              <h1 className="text-4xl font-bold mb-4">Admin Portal</h1>
              <p className="text-lg mb-8">
                Access advanced management features and system controls.
                Monitor venues, manage users, and analyze platform performance.
              </p>
            </>
          ) : (
            <>
              <Music4 className="h-20 w-20 mx-auto mb-8" />
              <h1 className="text-4xl font-bold mb-4">Local Tunes</h1>
              <p className="text-lg mb-8">
                Create collaborative playlists and share them with your guests through unique URLs.
                Perfect for venues, events, and gatherings.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}