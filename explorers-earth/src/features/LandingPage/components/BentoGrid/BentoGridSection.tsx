import BentoCard from './BentoCard';
import PlacesMockup from './mockups/PlacesMockup';
import MusicMockup from './mockups/MusicMockup';
import RecommendationsMockup from './mockups/RecommendationsMockup';
import GuidesMockup from './mockups/GuidesMockup';
import PublicProfileMockup from './mockups/PublicProfileMockup';

export default function BentoGridSection() {
  return (
    <section className="w-full py-20 px-4" style={{ backgroundColor: '#FAF7F2' }}>
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-14">
          <h2 className="text-[#1a1a2e] text-3xl md:text-5xl font-bold mb-4 leading-tight">
            Create your{' '}
            <span className="text-[#3498DB]">Explorer page</span>{' '}
            in minutes
          </h2>
          <p className="text-[#6b6b7b] text-lg max-w-2xl mx-auto">
            Interactive walkthroughs of every feature — exactly as they appear in your dashboard.
          </p>
        </div>

        {/* Top row — 3-col grid: Profile spans 2 cols, Places spans 1 col */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <BentoCard
            className="md:col-span-2 h-[520px]"
            title="Public Profile"
            subtitle="Your shareable page — showcase places, galleries & social links"
          >
            <PublicProfileMockup />
          </BentoCard>

          <BentoCard
            className="md:col-span-1 h-[520px]"
            title="Places & Recommendations"
            subtitle="Add locations, curate spots & share with the world"
          >
            <PlacesMockup />
          </BentoCard>
        </div>

        {/* Bottom row — 3 equal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BentoCard
            className="h-[460px]"
            title="Music"
            subtitle="Playlists, queue & guest controls"
          >
            <MusicMockup />
          </BentoCard>

          <BentoCard
            className="h-[460px]"
            title="Games · Books · Movies"
            subtitle="Create lists, search & add your favourites"
          >
            <RecommendationsMockup />
          </BentoCard>

          <BentoCard
            className="h-[460px]"
            title="Travel Guides"
            subtitle="Build itineraries, add destinations & publish"
          >
            <GuidesMockup />
          </BentoCard>
        </div>

      </div>
    </section>
  );
}
