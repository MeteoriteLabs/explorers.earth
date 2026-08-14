import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Palette, Music2, Lock, Loader2, HelpCircle, QrCode, Share2, PlayCircle, Settings2, Users2, ListMusic, Phone, Home, Globe, Laptop, Smartphone, MonitorSmartphone, LogOut, Info, MapPin, Tablet as TabletIcon, Mail } from "lucide-react";
import { MusicLoader } from "@/components/ui/music-loader";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { themeSchema } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { useWebSocket } from "@/hooks/use-websocket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, formatDistanceToNow } from "date-fns";
import React from 'react';
import { ProfileImageUpload } from "@/components/profile-image-upload";
import { useTheme } from "@/components/theme-provider"; // Change to use our ThemeContext
import { saveUserToStorage } from "@/lib/authStorage";

// Add new profile form schema
const profileFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profilePicture: z.string().optional(),
  countryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  streetName: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  instagramUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  facebookUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  youtubeUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  twitterUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  whatsappUrl: z.string().url("Please enter a valid URL").optional().or(z.literal(""))
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;


const settingsFormSchema = z.object({
  venueName: z.string().min(1, "Venue name is required").max(50, "Venue name must be less than 50 characters"),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
  allowSongRequests: z.boolean(),
  allowGuestPlayOnDevice: z.boolean(),
  allowPlaylistSharing: z.boolean(),
  allowRecentlyPlayedVisibility: z.boolean()
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Email form schema
const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional().or(z.literal(""))
});

// Username form schema
const usernameFormSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
type EmailFormValues = z.infer<typeof emailFormSchema>;
type UsernameFormValues = z.infer<typeof usernameFormSchema>;

// Define a type for the device sessions data returned from the API
interface DeviceSession {
  id: number;
  startTime: string;
  endTime: string | null;
  ipAddress: string;
  country?: string;
  region?: string;
  geoData?: string;
  device: {
    type: string;
    model: string;
    browser: string;
    os: string;
    isMobile: boolean;
    language: string;
  };
  fingerprint: string; // Added fingerprint for deduplication
  isCurrent: boolean;
  isActive: boolean;
}

export default function SettingsPage() {
  const { user, refetchUser } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { primary, updateTheme } = useTheme(); // Use our theme context

  // Fetch user device sessions
  const { data: deviceSessions, isLoading: isLoadingDevices, refetch: refetchDevices } = useQuery<DeviceSession[]>({
    queryKey: ["/api/user/devices"],
    enabled: false,
    initialData: [],
  });

  // Terminate session mutation
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      void sessionId;
      await Promise.reject(new Error("Music device sessions are managed in Explorer settings."));
    },
    onSuccess: () => {
      refetchDevices();
      toast({
        title: 'Session terminated',
        description: 'The device has been logged out successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to terminate session',
        description: error instanceof Error ? error.message : 'An error occurred while trying to log out this device.',
        variant: 'destructive'
      });
    }
  });

  // Password change form initialization
  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  // Email form initialization
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: user?.email || ""
    }
  });

  // Username form initialization
  const usernameForm = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameFormSchema),
    defaultValues: {
      username: user?.username || ""
    }
  });

  // Update username form when user data changes
  React.useEffect(() => {
    if (user?.username) {
      usernameForm.reset({ username: user.username });
    }
  }, [user?.username, usernameForm]);

  const onPasswordChange = async (data: PasswordChangeValues) => {
    try {
      void data;
      await Promise.reject(new Error("Music passwords are managed by your Explorer identity."));

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully."
      });

      passwordForm.reset();
    } catch (error) {
      toast({
        title: "Failed to change password",
        description: error instanceof Error ? error.message : "Please check your current password and try again.",
        variant: "destructive"
      });
    }
  };

  const onEmailSubmit = async (data: EmailFormValues) => {
    emailForm.reset({ email: user?.email || data.email });
    toast({
      title: "Managed by Explorer identity",
      description: "Email changes must be made in your Explorer identity settings.",
      variant: "destructive"
    });
  };

  const onUsernameSubmit = async (data: UsernameFormValues) => {
    usernameForm.reset({ username: user?.username || data.username });
    toast({
      title: "Managed by Explorer identity",
      description: "Username changes must be made in your Explorer identity settings.",
      variant: "destructive"
    });
  };



































































  // Settings form initialization

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      venueName: user?.venueName || "",
      primaryColor: user?.theme?.primary || "#6E56CF",
      allowSongRequests: user?.allowSongRequests ?? true,
      allowGuestPlayOnDevice: user?.allowGuestPlayOnDevice ?? true,
      allowPlaylistSharing: user?.allowPlaylistSharing ?? false,
      allowRecentlyPlayedVisibility: user?.allowRecentlyPlayedVisibility ?? true
    }
  });

  const handleSongRequestsToggle = async (checked: boolean) => {
    try {
      form.setValue("allowSongRequests", checked, {
        shouldDirty: true,
        shouldValidate: true
      });

      await onSubmit({
        ...form.getValues(),
        allowSongRequests: checked
      });
    } catch (error) {
      form.setValue("allowSongRequests", !checked, {
        shouldDirty: true,
        shouldValidate: true
      });
      toast({
        title: "Failed to update settings",
        description: "Could not update song request preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleGuestPlayToggle = async (checked: boolean) => {
    try {
      form.setValue("allowGuestPlayOnDevice", checked, {
        shouldDirty: true,
        shouldValidate: true
      });

      await onSubmit({
        ...form.getValues(),
        allowGuestPlayOnDevice: checked
      });
    } catch (error) {
      form.setValue("allowGuestPlayOnDevice", !checked, {
        shouldDirty: true,
        shouldValidate: true
      });
      toast({
        title: "Failed to update settings",
        description: "Could not update guest play preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRecentlyPlayedToggle = async (checked: boolean) => {
    try {
      form.setValue("allowRecentlyPlayedVisibility", checked, {
        shouldDirty: true,
        shouldValidate: true
      });

      await onSubmit({
        ...form.getValues(),
        allowRecentlyPlayedVisibility: checked
      });
    } catch (error) {
      form.setValue("allowRecentlyPlayedVisibility", !checked, {
        shouldDirty: true,
        shouldValidate: true
      });
      toast({
        title: "Failed to update settings",
        description: "Could not update recently played visibility preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      const updateData = {
        venueName: data.venueName,
        theme: {
          primary: data.primaryColor,
          variant: 'professional',
          appearance: 'system',
          radius: 0.5
        },
        allowSongRequests: data.allowSongRequests,
        allowGuestPlayOnDevice: data.allowGuestPlayOnDevice,
        allowPlaylistSharing: data.allowPlaylistSharing,
        allowRecentlyPlayedVisibility: data.allowRecentlyPlayedVisibility
      };

      // Optimistically update theme through context
      if (updateTheme) {
        updateTheme(data.primaryColor);
      }

      // Optimistically update cache with all changes
      const updatedUser = {

        ...user,
        venueName: data.venueName,
        theme: {
          ...user?.theme,
          primary: data.primaryColor
        },
        allowSongRequests: data.allowSongRequests,
        allowGuestPlayOnDevice: data.allowGuestPlayOnDevice,
        allowPlaylistSharing: data.allowPlaylistSharing,
        allowRecentlyPlayedVisibility: data.allowRecentlyPlayedVisibility
      };
      queryClient.setQueryData(["/api/user"], updatedUser);

      // Update local storage to persist across page refreshes
      if (updatedUser) {
        saveUserToStorage(updatedUser as any);
      }

      // Make the API request
      void updateData;
      await Promise.reject(new Error("Music profile settings are managed in Explorer."));

      // Update guest playlist if needed
      if (user?.guestUrl) {
        // Send WebSocket messages about all updates
        sendMessage({
          type: 'THEME_UPDATE',
          payload: { theme: updateData.theme }
        });

        if (data.allowSongRequests !== user.allowSongRequests) {
          sendMessage({
            type: 'SONG_REQUESTS_TOGGLE',
            payload: { enabled: data.allowSongRequests }
          });
        }
        if (data.allowGuestPlayOnDevice !== user.allowGuestPlayOnDevice) {
          sendMessage({
            type: 'GUEST_PLAY_TOGGLE',
            payload: { enabled: data.allowGuestPlayOnDevice }
          });
        }
        if (data.allowPlaylistSharing !== user.allowPlaylistSharing) {
          sendMessage({
            type: 'PLAYLIST_SHARING_TOGGLE',
            payload: { enabled: data.allowPlaylistSharing }
          });
        }
        if (data.allowRecentlyPlayedVisibility !== user.allowRecentlyPlayedVisibility) {
          sendMessage({
            type: 'RECENTLY_PLAYED_TOGGLE',
            payload: { enabled: data.allowRecentlyPlayedVisibility }
          });
        }

        await queryClient.invalidateQueries({
          queryKey: [`/api/playlist/${user.guestUrl}`]
        });
      }

      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully."
      });
    } catch (error) {
      // Revert theme on error
      if (updateTheme && user?.theme?.primary) {
        updateTheme(user.theme.primary);
      }

      // Revert cache on error
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      toast({
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "Could not save your changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Profile form initialization
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      profilePicture: profile?.profilePicture || "",
      countryCode: profile?.countryCode || "",
      phoneNumber: profile?.phoneNumber || "",
      streetName: profile?.streetName || "",
      state: profile?.state || "",
      city: profile?.city || "",
      country: profile?.country || "",
      postalCode: profile?.postalCode || "",
      instagramUrl: profile?.instagramUrl || "",
      facebookUrl: profile?.facebookUrl || "",
      youtubeUrl: profile?.youtubeUrl || "",
      twitterUrl: profile?.twitterUrl || "",
      whatsappUrl: profile?.whatsappUrl || ""
    }
  });

  // Update form values when profile data is loaded
  React.useEffect(() => {
    if (profile) {
      Object.entries(profile).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          profileForm.setValue(key as keyof ProfileFormValues, value);
        }
      });
    }
  }, [profile, profileForm]);

  const onProfileSubmit = async (data: ProfileFormValues) => {
    try {
      void data;
      await Promise.reject(new Error("Music profile settings are managed in Explorer."));
    } catch (error) {
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "Could not save your changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Only initialize WebSocket for feature toggle updates
  const { sendMessage } = useWebSocket(user?.guestUrl || '', () => { }, {
    enabled: true,
    showConnectionToasts: false // Disable connection toasts for settings page
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Show loading state while profile is being fetched
  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 max-w-2xl md:max-w-4xl lg:max-w-5xl space-y-6 sm:space-y-8 px-3 sm:px-4">
      <Tabs defaultValue="account" className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex w-full min-w-max md:grid md:grid-cols-6 gap-1">
            <TabsTrigger value="account" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <User className="h-3.5 w-3.5" />
              <span className="inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Users2 className="h-3.5 w-3.5" />
              <span className="inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="venue" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Palette className="h-3.5 w-3.5" />
              <span className="inline">Venue</span>
            </TabsTrigger>
            <TabsTrigger value="music" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Music2 className="h-3.5 w-3.5" />
              <span className="inline">Music</span>
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <Laptop className="h-3.5 w-3.5" />
              <span className="inline">Devices</span>
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap">
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="inline">Guide</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardContent className="pt-6">
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-8">
                  {/* Profile Picture Section */}
                  <ProfileImageUpload
                    currentImage={profileForm.watch("profilePicture")}
                    username={user.username}
                    onImageChange={(image) => {
                      profileForm.setValue("profilePicture", image || "", {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                    isUploading={profileForm.formState.isSubmitting}
                  />

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="countryCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country Code</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="+1" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="tel" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Address Information
                    </h3>
                    <FormField
                      control={profileForm.control}
                      name="streetName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Social Media Links */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Social Media Links
                    </h3>
                    <FormField
                      control={profileForm.control}
                      name="instagramUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Instagram Profile URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://instagram.com/username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="facebookUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facebook Profile URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://facebook.com/username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="youtubeUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>YouTube Channel URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://youtube.com/@channel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="twitterUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter Profile URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://twitter.com/username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="whatsappUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://wa.me/number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={profileForm.formState.isSubmitting || !profileForm.formState.isDirty}
                    className="w-full"
                  >
                    {profileForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving Profile...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Username
                </label>

                <div className="flex space-x-2">
                  <Input
                    type="text"
                    value={usernameForm.watch("username") || ""}
                    {...usernameForm.register("username")}
                    placeholder="Enter your username"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!usernameForm.formState.isDirty || usernameForm.formState.isSubmitting}
                    size="sm"
                  >
                    {usernameForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Update Username'
                    )}
                  </Button>
                </div>

                {usernameForm.formState.errors.username && (
                  <p className="text-sm text-destructive">
                    {usernameForm.formState.errors.username.message}
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  Username must be 3-30 characters and can only contain letters, numbers, underscores, and hyphens
                </p>
              </form>

              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="mt-6 space-y-2">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Email Address
                  </label>
                  {user.email && (
                    <Badge className={user.isEmailVerified ? "bg-green-600" : "bg-amber-600"}>
                      {user.isEmailVerified ? "Verified" : "Not Verified"}
                    </Badge>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Input
                    type="email"
                    value={emailForm.watch("email") || ""}
                    {...emailForm.register("email")}
                    placeholder="Enter your email address"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!emailForm.formState.isDirty || emailForm.formState.isSubmitting}
                    size="sm"
                  >
                    {emailForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Update Email'
                    )}
                  </Button>
                </div>

                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}

                {user.email && !user.isEmailVerified && (
                  <div className="text-sm text-amber-600 flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    Please check your inbox and verify your email address.
                    <Button
                      variant="link"
                      size="sm"
                      className="px-1 h-auto"
                      onClick={() => {
                        apiRequest('POST', '/api/user/resend-verification')
                          .then(() => {
                            // Update UI optimistically to acknowledge the action
                            toast({
                              title: "Verification email sent",
                              description: "Please check your inbox for the verification link.",
                            });

                            // Force refetch user data to get the latest status
                            refetchUser();
                          })
                          .catch(error => {
                            toast({
                              title: "Failed to send verification email",
                              description: error.message || "An error occurred. Please try again.",
                              variant: "destructive"
                            });
                          });
                      }}
                    >
                      Resend email
                    </Button>
                  </div>
                )}
              </form>

              <Accordion type="single" collapsible>
                <AccordionItem value="password">
                  <AccordionTrigger className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Change Password
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4">
                      <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordChange)} className="space-y-4">
                          <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            disabled={passwordForm.formState.isSubmitting || !passwordForm.formState.isDirty}
                            className="w-full"
                          >
                            {passwordForm.formState.isSubmitting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Changing Password...
                              </>
                            ) : (
                              "Change Password"
                            )}
                          </Button>
                        </form>
                      </Form>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Venue Tab */}
        <TabsContent value="venue">
          <Card>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="venueName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your venue name"
                            {...field}
                            className="font-medium"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand Color</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="color"
                                {...field}
                                className="w-20 h-10 p-1 cursor-pointer"
                                onChange={(e) => {
                                  let color = e.target.value.toUpperCase();
                                  if (color.length > 0 && !color.startsWith('#')) {
                                    color = '#' + color;
                                  }
                                  if (color.length > 7) {
                                    color = color.slice(0, 7);
                                  }
                                  field.onChange(color);
                                }}
                              />
                              <div
                                className="absolute inset-0 pointer-events-none rounded-md border border-input"
                                style={{ backgroundColor: field.value }}
                              />
                            </div>
                          </FormControl>
                          <Input
                            value={field.value}
                            onChange={(e) => {
                              let color = e.target.value.toUpperCase();
                              if (color.length > 0 && !color.startsWith('#')) {
                                color = '#' + color;
                              }
                              if (color.length > 7) {
                                color = color.slice(0, 7);
                              }
                              field.onChange(color);
                            }}
                            placeholder="#000000"
                            className="font-mono"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting || !form.formState.isDirty}
                    className="w-full"
                  >
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Music Tab */}
        <TabsContent value="music">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Song Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow guests to search and request songs for your playlist
                  </p>
                </div>
                <Switch
                  checked={form.watch("allowSongRequests")}
                  onCheckedChange={handleSongRequestsToggle}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Guest Play on Device</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow guests to play music directly on their devices
                  </p>
                </div>
                <Switch
                  checked={form.watch("allowGuestPlayOnDevice")}
                  onCheckedChange={handleGuestPlayToggle}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Playlist Sharing</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow guests to view and add songs from your saved playlists
                  </p>
                </div>
                <Switch
                  checked={form.watch("allowPlaylistSharing")}
                  onCheckedChange={(checked) => {
                    form.setValue("allowPlaylistSharing", checked, {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                    onSubmit({
                      ...form.getValues(),
                      allowPlaylistSharing: checked
                    });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Recently Played Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow guests to see the recently played songs section
                  </p>
                </div>
                <Switch
                  checked={form.watch("allowRecentlyPlayedVisibility")}
                  onCheckedChange={handleRecentlyPlayedToggle}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Login Devices</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchDevices()}
                    disabled={isLoadingDevices}
                  >
                    {isLoadingDevices ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <span>Refresh</span>
                    )}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  These are all the devices where you are currently logged in. You can review them and terminate any sessions you don't recognize.
                </p>

                {isLoadingDevices ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !deviceSessions || deviceSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Laptop className="h-12 w-12 mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">No devices found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-2">
                      We couldn't find any active device sessions. Try refreshing the list.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-w-[calc(100vw-3rem)] md:max-w-none">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/4 md:w-[22%]">Device</TableHead>
                          <TableHead className="w-1/4 md:w-[22%]">Location</TableHead>
                          <TableHead className="w-1/4 md:w-[26%] whitespace-nowrap">Last Active</TableHead>
                          <TableHead className="w-1/8 md:w-[15%]">Status</TableHead>
                          <TableHead className="w-1/8 md:w-[15%] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceSessions.map((session) => (
                          <TableRow key={session.id}>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-start gap-3">
                                <div className="rounded-md bg-muted p-2">
                                  {session.device.type === 'mobile' ? (
                                    <Smartphone className="h-4 w-4" />
                                  ) : session.device.type === 'tablet' ? (
                                    <TabletIcon className="h-4 w-4" />
                                  ) : (
                                    <Laptop className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium">{session.device.model || session.device.browser}</div>
                                  <div className="text-xs text-muted-foreground">{session.device.os}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <div>
                                  <span className="text-sm">
                                    {session.country || session.region ? (
                                      <>
                                        {session.country || 'Unknown'}
                                        {session.region && session.region !== 'Unknown' && (
                                          <>, {session.region}</>
                                        )}
                                      </>
                                    ) : (
                                      'Location not available'
                                    )}
                                  </span>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {session.ipAddress || 'IP not available'}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {session.startTime ? (
                                <div className="text-sm">
                                  {format(new Date(session.startTime), 'MMM d, yyyy')}
                                  <div className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unknown</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {session.isActive ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                  Inactive
                                </Badge>
                              )}
                              {session.isCurrent && (
                                <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">
                                  Current
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={session.isCurrent || terminateSessionMutation.isPending}
                                  >
                                    <LogOut className="h-4 w-4 mr-1" />
                                    Terminate
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Terminate this session?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will log out the device immediately. You will need to log in again if you want to use this device.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => terminateSessionMutation.mutate(session.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {terminateSessionMutation.isPending ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Terminating...
                                        </>
                                      ) : (
                                        "Yes, log out device"
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="bg-muted rounded-lg p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Info className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-1">About device tracking</h3>
                      <p className="text-sm text-muted-foreground">
                        For your security, we keep track of devices where you've logged in. If you see a device you don't recognize, terminate the session immediately and consider changing your password.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guide Tab */}
        <TabsContent value="guide">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <Accordion type="single" collapsible className="w-full">
                {/* Getting Started */}
                <AccordionItem value="getting-started">
                  <AccordionTrigger className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Getting Started
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <h4 className="font-semibold">Welcome to Cosmic!</h4>
                    <p className="text-sm text-muted-foreground">
                      Cosmic is your all-in-one solution for managing music in your venue. Here's how to get started:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                      <li>Set up your venue name and brand colors in the Venue tab</li>
                      <li>Create playlists and add your favorite songs</li>
                      <li>Share your unique guest URL with your audience</li>
                      <li>Monitor and manage song requests in real-time</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* Playlist Management */}
                <AccordionItem value="playlist-management">
                  <AccordionTrigger className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4" />
                    Playlist Management
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <h4 className="font-semibold">Managing Your Playlists</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium">Creating Playlists</h5>
                        <p className="text-sm text-muted-foreground">
                          Create themed playlists for different occasions or moods. Add songs by searching YouTube or importing from existing playlists.
                        </p>
                      </div>
                      <div>
                        <h5 className="font-medium">Queue Management</h5>
                        <p className="text-sm text-muted-foreground">
                          - Drag and drop songs to reorder the queue<br />
                          - Remove songs using the delete button<br />
                          - Skip to any song by clicking the play button
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Guest Interaction */}
                <AccordionItem value="guest-interaction">
                  <AccordionTrigger className="flex items-center gap-2">
                    <Users2 className="h-4 w-4" />
                    Guest Interaction
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <h4 className="font-semibold">Managing Guest Access</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium">Sharing Your Playlist</h5>
                        <p className="text-sm text-muted-foreground">
                          Share your playlist using:
                          - The unique guest URL<br />
                          - QR code for easy mobile access<br />
                          - Direct sharing buttons for social media
                        </p>
                      </div>
                      <div>
                        <h5 className="font-medium">Guest Features</h5>
                        <p className="text-sm text-muted-foreground">
                          Control what guests can do:
                          - Enable/disable song requests<br />
                          - Allow guests to play music on their devices<br />
                          - Share saved playlists with guests
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Feature Controls */}
                <AccordionItem value="feature-controls">
                  <AccordionTrigger className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Feature Controls
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <h4 className="font-semibold">Customizing Your Experience</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium">Music Settings</h5>
                        <p className="text-sm text-muted-foreground">
                          In the Music tab, you can:
                          - Toggle song requests on/off<br />
                          - Enable/disable guest playback<br />
                          - Control playlist sharing visibility
                        </p>
                      </div>
                      <div>
                        <h5 className="font-medium">Venue Customization</h5>
                        <p className="text-sm text-muted-foreground">
                          In the Venue tab, you can:
                          - Update your venue name<br />
                          - Customize brand colors<br />
                          - Adjust the look and feel of your playlist page
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Sharing & Integration */}
                <AccordionItem value="sharing-integration">
                  <AccordionTrigger className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Sharing & Integration
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <h4 className="font-semibold">Sharing Your Music</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-medium">QR Code Access</h5>
                        <p className="text-sm text-muted-foreground">
                          Generate and display QR codes for easy access:
                          - Print QR codes fortable tents<br />
                          - Add QR codes to menus or displays<br />
                          - ShareQrcodes on social media
                        </p>
                      </div>
                      <div>
                        <h5 className="font-medium">Direct Links</h5>
                        <p className="text-sm text-muted-foreground">
                          Share your playlist through:
                          - Direct guest URL<br />
                          - Social media integration<br />
                          - Embedded player options
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
