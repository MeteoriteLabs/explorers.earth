import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { queryClient } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';

const pageSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

type PageFormValues = z.infer<typeof pageSchema>;

function PageContentForm({ 
  defaultValues,
  pageSlug,
  onSuccess
}: { 
  defaultValues: PageFormValues;
  pageSlug: string;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: PageFormValues) => {
      const response = await fetch(`/api/admin/page-contents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          slug: pageSlug,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create page content');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `${pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1)} page content created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/page-contents/${pageSlug}`] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: PageFormValues) => {
      const response = await fetch(`/api/admin/page-contents/${pageSlug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update page content');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `${pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1)} page content updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/page-contents/${pageSlug}`] });
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  async function onSubmit(values: PageFormValues) {
    setIsSubmitting(true);
    
    if (defaultValues.title && defaultValues.content) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter page title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormDescription>
                You can use HTML tags for formatting. The content will be displayed as HTML on the page.
              </FormDescription>
              <FormControl>
                <Textarea
                  placeholder="Enter page content with HTML formatting"
                  className="min-h-[400px] font-mono text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isSubmitting || !form.formState.isDirty}
          className="w-full sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Spinner size="small" className="mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </form>
    </Form>
  );
}

function TermsOfServiceTab() {
  const { data: pageContent, isLoading, error } = useQuery({
    queryKey: ['/api/page-contents/terms'],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="large" />
      </div>
    );
  }

  const defaultValues = {
    title: pageContent?.title || 'Terms of Service',
    content: pageContent?.content || '',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Terms of Service</CardTitle>
      </CardHeader>
      <CardContent>
        <PageContentForm 
          defaultValues={defaultValues} 
          pageSlug="terms"
        />
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Last updated: {pageContent?.updatedAt 
            ? new Date(pageContent.updatedAt).toLocaleString() 
            : 'Never'}
        </div>
        <a 
          href="/terms" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          View Live Page
        </a>
      </CardFooter>
    </Card>
  );
}

function PrivacyPolicyTab() {
  const { data: pageContent, isLoading, error } = useQuery({
    queryKey: ['/api/page-contents/privacy'],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="large" />
      </div>
    );
  }

  const defaultValues = {
    title: pageContent?.title || 'Privacy Policy',
    content: pageContent?.content || '',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Policy</CardTitle>
      </CardHeader>
      <CardContent>
        <PageContentForm 
          defaultValues={defaultValues} 
          pageSlug="privacy"
        />
      </CardContent>
      <CardFooter className="flex justify-between border-t px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Last updated: {pageContent?.updatedAt 
            ? new Date(pageContent.updatedAt).toLocaleString() 
            : 'Never'}
        </div>
        <a 
          href="/privacy" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-primary hover:underline"
        >
          View Live Page
        </a>
      </CardFooter>
    </Card>
  );
}

export default function WebsiteTab() {
  return (
    <Tabs defaultValue="terms" className="w-full space-y-6">
      <TabsList className="grid w-full md:w-auto grid-cols-2">
        <TabsTrigger value="terms">Terms of Service</TabsTrigger>
        <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
      </TabsList>
      <TabsContent value="terms">
        <TermsOfServiceTab />
      </TabsContent>
      <TabsContent value="privacy">
        <PrivacyPolicyTab />
      </TabsContent>
    </Tabs>
  );
}