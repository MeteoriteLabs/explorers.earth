import React, { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SeoSettings } from "@shared/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Save } from "lucide-react";
export default function SeoTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");
  const queryClient = useQueryClient();
  
  // Get super admin status from main component
  const isSuperAdmin = user?.username === 'yapral27';
  
  // Return access denied message if not a super admin
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view or modify SEO settings. Only super administrators have access to this feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch current SEO settings
  const { data: seoSettings, isLoading, error } = useQuery<SeoSettings>({
    queryKey: ['/api/seo'],
    staleTime: 60000, // 1 minute
  });

  // Define schema for SEO settings form
  const seoFormSchema = z.object({
    siteTitle: z.string().min(5, "Site title must be at least 5 characters"),
    metaDescription: z.string().min(20, "Meta description must be at least 20 characters"),
    metaKeywords: z.string().min(3, "Meta keywords are required"),
    ogTitle: z.string().min(5, "Open Graph title must be at least 5 characters"),
    ogDescription: z.string().min(20, "Open Graph description must be at least 20 characters"),
    ogImage: z.string().min(1, "Open Graph image path is required"),
    twitterTitle: z.string().min(5, "Twitter title must be at least 5 characters"),
    twitterDescription: z.string().min(20, "Twitter description must be at least 20 characters"),
    twitterImage: z.string().min(1, "Twitter image path is required"),
    robotsTxt: z.string().min(1, "Robots.txt content is required"),
    sitemapXml: z.string().min(1, "Sitemap XML content is required"),
    googleAnalyticsId: z.string().optional(),
    facebookPixelId: z.string().optional(),
    googleTagManagerId: z.string().optional(),
    microsoftClarityId: z.string().optional(),
  });

  type SeoFormValues = z.infer<typeof seoFormSchema>;

  // Form setup with react-hook-form and zod validation
  const form = useForm<SeoFormValues>({
    resolver: zodResolver(seoFormSchema),
    defaultValues: {
      siteTitle: '',
      metaDescription: '',
      metaKeywords: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      twitterTitle: '',
      twitterDescription: '',
      twitterImage: '',
      robotsTxt: '',
      sitemapXml: '',
      googleAnalyticsId: '',
      facebookPixelId: '',
      googleTagManagerId: '',
      microsoftClarityId: '',
    },
  });

  // Update form values when settings are loaded
  React.useEffect(() => {
    if (seoSettings) {
      // Type cast values to match the expected form schema
      const formValues: SeoFormValues = {
        siteTitle: seoSettings.siteTitle,
        metaDescription: seoSettings.metaDescription,
        metaKeywords: seoSettings.metaKeywords,
        ogTitle: seoSettings.ogTitle,
        ogDescription: seoSettings.ogDescription,
        ogImage: seoSettings.ogImage,
        twitterTitle: seoSettings.twitterTitle,
        twitterDescription: seoSettings.twitterDescription,
        twitterImage: seoSettings.twitterImage,
        robotsTxt: seoSettings.robotsTxt,
        sitemapXml: seoSettings.sitemapXml,
        googleAnalyticsId: seoSettings.googleAnalyticsId || '',
        facebookPixelId: seoSettings.facebookPixelId || '',
        googleTagManagerId: seoSettings.googleTagManagerId || '',
        microsoftClarityId: seoSettings.microsoftClarityId || '',
      };
      form.reset(formValues);
    }
  }, [seoSettings, form]);

  // Update SEO settings mutation
  const updateSeoMutation = useMutation({
    mutationFn: (data: SeoFormValues) => {
      return apiRequest('PUT', '/api/seo', data);
    },
    onSuccess: () => {
      toast({
        title: "SEO settings updated",
        description: "SEO settings have been successfully updated.",
      });
      // Invalidate the SEO query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/seo'] });
    },
    onError: (error) => {
      console.error('Error updating SEO settings:', error);
      toast({
        title: "Error updating SEO settings",
        description: "An error occurred while updating SEO settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: SeoFormValues) => {
    updateSeoMutation.mutate(data);
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Loader2 className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load SEO settings. Please try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="basic">Basic SEO</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          {/* Basic SEO Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic SEO Settings</CardTitle>
                <CardDescription>Configure your website's basic SEO metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="siteTitle">Site Title</Label>
                  <Input
                    id="siteTitle"
                    {...form.register("siteTitle")}
                    placeholder="Cosmic - Collaborative Playlist Management Platform"
                  />
                  {form.formState.errors.siteTitle && (
                    <p className="text-red-500 text-sm">{form.formState.errors.siteTitle.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <Textarea
                    id="metaDescription"
                    {...form.register("metaDescription")}
                    placeholder="A brief description of your website (150-160 characters recommended)"
                    rows={3}
                  />
                  {form.formState.errors.metaDescription && (
                    <p className="text-red-500 text-sm">{form.formState.errors.metaDescription.message}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="metaKeywords">Meta Keywords</Label>
                  <Input
                    id="metaKeywords"
                    {...form.register("metaKeywords")}
                    placeholder="music, playlist, collaboration, venue, event, sharing, youtube"
                  />
                  {form.formState.errors.metaKeywords && (
                    <p className="text-red-500 text-sm">{form.formState.errors.metaKeywords.message}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Separate keywords with commas</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Settings</CardTitle>
                <CardDescription>Configure how your website appears when shared on social media</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="mb-6">
                  <Badge className="mb-3">Open Graph (Facebook, LinkedIn)</Badge>
                  <div className="space-y-3">
                    <Label htmlFor="ogTitle">Open Graph Title</Label>
                    <Input
                      id="ogTitle"
                      {...form.register("ogTitle")}
                      placeholder="Cosmic - Transform Your Music Experience"
                    />
                    {form.formState.errors.ogTitle && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogTitle.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="ogDescription">Open Graph Description</Label>
                    <Textarea
                      id="ogDescription"
                      {...form.register("ogDescription")}
                      placeholder="Create immersive and interactive music experiences with Cosmic collaborative playlists"
                      rows={2}
                    />
                    {form.formState.errors.ogDescription && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogDescription.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="ogImage">Open Graph Image Path</Label>
                    <Input
                      id="ogImage"
                      {...form.register("ogImage")}
                      placeholder="/logo-social.png"
                    />
                    {form.formState.errors.ogImage && (
                      <p className="text-red-500 text-sm">{form.formState.errors.ogImage.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="mt-6">
                  <Badge className="mb-3">Twitter Card</Badge>
                  <div className="space-y-3">
                    <Label htmlFor="twitterTitle">Twitter Title</Label>
                    <Input
                      id="twitterTitle"
                      {...form.register("twitterTitle")}
                      placeholder="Cosmic Music Platform"
                    />
                    {form.formState.errors.twitterTitle && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterTitle.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="twitterDescription">Twitter Description</Label>
                    <Textarea
                      id="twitterDescription"
                      {...form.register("twitterDescription")}
                      placeholder="Advanced playlist management for venues and events"
                      rows={2}
                    />
                    {form.formState.errors.twitterDescription && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterDescription.message}</p>
                    )}
                  </div>

                  <div className="space-y-3 mt-3">
                    <Label htmlFor="twitterImage">Twitter Image Path</Label>
                    <Input
                      id="twitterImage"
                      {...form.register("twitterImage")}
                      placeholder="/logo-social.png"
                    />
                    {form.formState.errors.twitterImage && (
                      <p className="text-red-500 text-sm">{form.formState.errors.twitterImage.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced SEO Settings</CardTitle>
                <CardDescription>Configure robots.txt and sitemap.xml</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="robotsTxt">robots.txt Content</Label>
                  <Textarea
                    id="robotsTxt"
                    {...form.register("robotsTxt")}
                    placeholder="User-agent: *\nAllow: /"
                    rows={6}
                    className="font-mono text-sm"
                  />
                  {form.formState.errors.robotsTxt && (
                    <p className="text-red-500 text-sm">{form.formState.errors.robotsTxt.message}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    This will be served at <code>/robots.txt</code>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <Label htmlFor="sitemapXml">sitemap.xml Content</Label>
                  <Textarea
                    id="sitemapXml"
                    {...form.register("sitemapXml")}
                    placeholder='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://cosmic.app/</loc>\n    <lastmod>2025-04-03</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>'
                    rows={12}
                    className="font-mono text-sm"
                  />
                  {form.formState.errors.sitemapXml && (
                    <p className="text-red-500 text-sm">{form.formState.errors.sitemapXml.message}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    This will be served at <code>/sitemap.xml</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Tab */}
          <TabsContent value="tracking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Tracking</CardTitle>
                <CardDescription>Configure tracking and analytics services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                  <Input
                    id="googleAnalyticsId"
                    {...form.register("googleAnalyticsId")}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="googleTagManagerId">Google Tag Manager ID</Label>
                  <Input
                    id="googleTagManagerId"
                    {...form.register("googleTagManagerId")}
                    placeholder="GTM-XXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="facebookPixelId">Facebook Pixel ID</Label>
                  <Input
                    id="facebookPixelId"
                    {...form.register("facebookPixelId")}
                    placeholder="XXXXXXXXXX"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="microsoftClarityId">Microsoft Clarity ID</Label>
                  <Input
                    id="microsoftClarityId"
                    {...form.register("microsoftClarityId")}
                    placeholder="XXXXXXXXXX"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end">
          <Button 
            type="submit" 
            className="flex items-center gap-2" 
            disabled={updateSeoMutation.isPending}
          >
            {updateSeoMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save SEO Settings
          </Button>
        </div>
      </form>
    </div>
  );
}


