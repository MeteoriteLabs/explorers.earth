import LandingHeader from '../features/LandingPage/components/LandingHeader';
import Hero from '../features/LandingPage/components/Hero';
import BentoGridSection from '../features/LandingPage/components/BentoGrid/BentoGridSection';
import CreateCustomize from '../features/LandingPage/components/CreateCustomize';
import ShareAnywhere from '../features/LandingPage/components/ShareAnywhere';
import Analytics from '../features/LandingPage/components/Analytics';
// import ReferEarn from '../features/LandingPage/components/ReferEarn';
import WhoIsFor from '../features/LandingPage/components/WhoIsFor';
import Testimonials from '../features/LandingPage/components/Testimonials';
import LocalTunesHero from '../features/LandingPage/components/LocalTunesHero';
import FAQ from '../features/LandingPage/components/FAQ';
// import Features from '../features/LandingPage/components/Features';
import FinalCTA from '../features/LandingPage/components/FinalCTA';
import Footer from '../features/LandingPage/components/Footer';
import CookieConsent from '../features/LandingPage/components/CookieConsent';
import SEO from '../components/SEO';
import { createOrganizationGEOData } from '../utils/geoHelpers';
import { createCanonicalUrl, getBaseUrl } from '../utils/getCurrentDomain';

export default function Landing() {
  // Generate GEO data for landing page
  const geoData = createOrganizationGEOData({
    name: "explorers",
    description: "Discover and share your favorite local spots with personalized QR codes and shareable links",
    url: getBaseUrl(),
    features: [
      'Personalized QR code generation',
      'Local recommendation sharing',
      'Analytics and insights',
      'Mobile-optimized design',
      'Community discovery'
    ],
    industry: 'Technology'
  });

  return (
    <>
      <SEO
        title="explorers - Discover & Share Personalized Local Recommendations"
        description=" Discover and share your favorite local spots with explorers. 
        Create personalized city guides, organize must-visit places, and make them discoverable with shareable QR codes.
        Explore hidden gems, curated recommendations, and local travel tips on interactive maps."
        keywords={[
          "discover places near me",
          "personalized travel guides",
          "local recommendations app",
          "city guide creator",
          "share travel tips",
          "hidden gems recommendations",
          "things to do in city",
          "map-based travel guide",
          "best local spots",
          "curated restaurant recommendations",
          "travel guide QR codes",
          "create and share location lists",
          "user-generated local guides",
          "explore places around you",
          "digital city guides",
          'QR codes',
          'local recommendations',
          'place sharing',
          'travel guide',
          'local business',
          'digital recommendations',
          'shareable links',
          'location sharing',
          'travel tips',
          'local spots',
          'restaurant recommendations',
          'travel QR',
          'local knowledge',
          'city guide',
          'place discovery'
        ]}
        canonical={createCanonicalUrl("/")}
        image={`${getBaseUrl()}/og-landing-image.jpg`}
        type="website"
        author="explorers Team"
        enableGEO={true}
        geoData={geoData}
      />

      <div className="min-h-screen w-full overflow-x-hidden max-w-[100vw]">
        <LandingHeader />
        <Hero />
        <BentoGridSection />
        <CreateCustomize />
        <ShareAnywhere />
        <Analytics />
        {/* <ReferEarn /> */}
        <WhoIsFor />
        <Testimonials />
        <LocalTunesHero />
        <FAQ />
        {/* <Features /> */}
        <FinalCTA />
        <Footer />
        <CookieConsent />
      </div>
    </>
  );
}
