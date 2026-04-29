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
    <section className="w-full py-20 px-4 dashboard-theme bg-[#0F1419]">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-14">
          <h2 className="text-white text-3xl md:text-5xl font-bold mb-4">
            Everything you need in{' '}
            <span className="text-[#3498DB]">one place</span>.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Interactive walkthroughs of every feature — exactly as they appear in your dashboard.
          </p>
        </div>

        {/* Uniform 3×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <BentoCard className="h-[480px]">
            <PlacesMockup />
          </BentoCard>

          <BentoCard className="h-[480px]">
            <MusicMockup />
          </BentoCard>

          <BentoCard className="h-[480px]">
            <GamesMockup />
          </BentoCard>

          <BentoCard className="h-[480px]">
            <BooksMockup />
          </BentoCard>

          <BentoCard className="h-[480px]">
            <MoviesMockup />
          </BentoCard>

          <BentoCard className="h-[480px]">
            <GuidesMockup />
          </BentoCard>
        </div>

      </div>
    </section>
  );
}
