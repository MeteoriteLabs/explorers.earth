import React from 'react';
import BentoCard from './BentoCard';
import PlacesMockup from './mockups/PlacesMockup';
import MusicMockup from './mockups/MusicMockup';
import GamesMockup from './mockups/GamesMockup';
import BooksMockup from './mockups/BooksMockup';
import MoviesMockup from './mockups/MoviesMockup';
import GuidesMockup from './mockups/GuidesMockup';

export default function BentoGridSection() {
  return (
    <section className="w-full py-20 px-4 dashboard-theme bg-dashboard-bg">
      <div className="max-w-7xl mx-auto">

        <div className="text-center mb-16">
          <h2 className="dt-heading text-3xl md:text-5xl font-bold mb-4">
            Everything you need in <span className="text-dashboard-accent">one place</span>.
          </h2>
          <p className="dt-subtext text-lg max-w-2xl mx-auto">
            Interactive walkthroughs of every feature — exactly as they appear in your dashboard.
          </p>
        </div>

        {/* Row 1: Places (large) + Music + Games */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          <BentoCard className="lg:col-span-3 min-h-[520px]">
            <PlacesMockup />
          </BentoCard>

          <div className="lg:col-span-2 grid grid-rows-2 gap-4">
            <BentoCard className="min-h-[250px]">
              <MusicMockup />
            </BentoCard>
            <BentoCard className="min-h-[250px]">
              <GamesMockup />
            </BentoCard>
          </div>
        </div>

        {/* Row 2: Books + Movies + Guides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BentoCard className="min-h-[420px]">
            <BooksMockup />
          </BentoCard>
          <BentoCard className="min-h-[420px]">
            <MoviesMockup />
          </BentoCard>
          <BentoCard className="min-h-[420px]">
            <GuidesMockup />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
