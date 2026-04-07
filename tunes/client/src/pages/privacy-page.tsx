import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Spinner from '@/components/ui/spinner';
import Container from '@/components/ui/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEO from '@/components/SEO';
import { createWebPageGEOData } from '@/utils/geoHelpers';

export default function PrivacyPage() {
  const [error, setError] = useState<string | null>(null);

  const { data: pageContent, isLoading } = useQuery({
    queryKey: ['/api/page-contents/privacy'],
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const geoData = createWebPageGEOData({
    pageName: 'Privacy Policy',
    pageDescription: 'Privacy Policy for Local Tunes - how we collect, use, and protect your data.',
  });

  const seoElement = (
    <SEO
      title="Privacy Policy | Local Tunes"
      description="Privacy Policy for Local Tunes - how we collect, use, and protect your data."
      canonical="/privacy"
      url="/privacy"
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
          <p className="text-muted-foreground">Loading Privacy Policy...</p>
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
            <p>We encountered an error while loading the Privacy Policy: {error}</p>
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
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Privacy Policy content is currently being updated. Please check back later.</p>
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