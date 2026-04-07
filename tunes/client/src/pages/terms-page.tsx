import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Spinner from '@/components/ui/spinner';
import Container from '@/components/ui/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEO from '@/components/SEO';
import { createWebPageGEOData } from '@/utils/geoHelpers';

export default function TermsPage() {
  const [error, setError] = useState<string | null>(null);

  const { data: pageContent, isLoading } = useQuery({
    queryKey: ['/api/page-contents/terms'],
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const geoData = createWebPageGEOData({
    pageName: 'Terms of Service',
    pageDescription: 'Terms of Service for Local Tunes - the rules and guidelines for using our platform.',
  });

  const seoElement = (
    <SEO
      title="Terms of Service | Local Tunes"
      description="Terms of Service for Local Tunes - the rules and guidelines for using our platform."
      canonical="/terms"
      url="/terms"
      enableGEO={true}
      geoData={geoData}
    />
  );

  if (isLoading) {
    return (
      <Container className="flex items-center justify-center min-h-[70vh]">
        {seoElement}
        <div className="text-center">
          <Spinner size="large" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Terms of Service...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        {seoElement}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Content</CardTitle>
          </CardHeader>
          <CardContent>
            <p>We encountered an error while loading the Terms of Service: {error}</p>
            <p className="mt-2">Please try again later or contact support if the problem persists.</p>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (!pageContent) {
    return (
      <Container>
        {seoElement}
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Terms of Service content is currently being updated. Please check back later.</p>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      {seoElement}
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{pageContent.title}</CardTitle>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(pageContent.updatedAt || pageContent.createdAt).toLocaleDateString()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: pageContent.content }} />
        </CardContent>
      </Card>
    </Container>
  );
}