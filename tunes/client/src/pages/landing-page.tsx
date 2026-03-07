import { useState } from "react";
import { Link } from "wouter";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import PlayerMockup from "../components/player-mockup";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Radio, Music2, ListMusic, Share2, PlayCircle, History, Palette, ShieldCheck, Mic2, Headphones, Users2, Building2, ThumbsUp, Coffee, Beer, ShoppingBag, PartyPopper, Utensils, Dumbbell, Home, HelpCircle, Book, Heart, Facebook, Twitter, Instagram, QrCode, MapPin, BarChart3, Users, Globe, ArrowRight } from "lucide-react";
import { motion } from 'framer-motion';

function LocalQRHero() {
  const features = [
    {
      icon: QrCode,
      title: "Personalized QR Codes",
      description: "Generate unique QR codes for your local recommendations and favorite spots."
    },
    {
      icon: MapPin,
      title: "Location Discovery",
      description: "Discover and share hidden gems, restaurants, cafes, and local attractions."
    },
    {
      icon: Share2,
      title: "Easy Sharing",
      description: "Share your curated lists with friends, family, and customers through QR codes."
    },
    {
      icon: BarChart3,
      title: "Analytics & Insights",
      description: "Track engagement and see which recommendations resonate most with your audience."
    },
    {
      icon: Users,
      title: "Community Building",
      description: "Connect with like-minded people who share your passion for local discovery."
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Share your local knowledge with travelers and visitors from around the world."
    }
  ];

  const useCases = [
    { name: "Restaurant Owners", icon: "🍽️" },
    { name: "Hotel Concierges", icon: "🏨" },
    { name: "Travel Influencers", icon: "✈️" },
    { name: "Airbnb Hosts", icon: "🏠" },
    { name: "Event Planners", icon: "🎯" },
    { name: "Content Creators", icon: "📱" }
  ];

  return (
    <section className="py-6 sm:py-8 lg:py-10 relative overflow-hidden bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-48 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -left-48 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-7xl">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8 sm:mb-10"
        >

          {/* Main Heading with gradient */}
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent"
          >
            LocalQR
          </motion.h2>
          
          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            Discover and share your favorite local spots with{' '}
            <span className="text-blue-300 font-semibold">personalized QR codes</span>
            . Create curated city guides and make them{' '}
            <span className="text-cyan-300 font-semibold">instantly discoverable</span>.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <button className="group relative px-8 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 w-full sm:w-auto">
              <span className="relative z-10 flex items-center justify-center gap-2">
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            </button>
            <button className="px-8 py-3.5 border-2 border-blue-400/30 text-blue-200 font-semibold rounded-xl hover:bg-blue-500/10 hover:border-blue-400/50 transition-all duration-300 backdrop-blur-sm w-full sm:w-auto">
              Learn More
            </button>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-12 sm:mb-16"
        >
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
            Powerful Features
          </h3>
          
          <div className="flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.1,
                    hover: { duration: 0.2 }
                  }}
                  viewport={{ once: true }}
                  className="group relative bg-gradient-to-br from-blue-900/30 via-cyan-900/20 to-blue-900/30 backdrop-blur-md border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300 flex-shrink-0 w-80 sm:w-96 snap-start shadow-xl hover:shadow-blue-500/20"
                >
                  {/* Card glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all duration-300"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-start space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <IconComponent className="text-white w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-2 text-blue-200 group-hover:text-blue-100 transition-colors duration-300">
                          {feature.title}
                        </h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Use Cases */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
            Perfect for Everyone
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
            {useCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.08, y: -4 }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.1,
                  hover: { duration: 0.2 }
                }}
                viewport={{ once: true }}
                className="group relative bg-gradient-to-br from-blue-900/30 via-cyan-900/20 to-blue-900/30 backdrop-blur-md border border-blue-500/20 rounded-xl p-5 text-center hover:border-blue-400/40 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-blue-500/20"
              >
                {/* Card glow effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all duration-300"></div>
                
                <div className="relative z-10">
                  <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
                    {useCase.icon}
                  </div>
                  <p className="text-blue-200 text-sm font-semibold group-hover:text-blue-100 transition-colors duration-300">
                    {useCase.name}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-12 sm:mt-16"
        >
          <p className="text-gray-400 text-sm sm:text-base mb-4">
            Join thousands discovering and sharing local experiences
          </p>
          <div className="flex justify-center gap-2 text-blue-300">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            ))}
          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `
      }} />
    </section>
  );
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'hosts' | 'guests'>('hosts');
  
  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#121212]/90 backdrop-blur-sm border-b border-border/40">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <nav className="flex justify-between items-center">
            <div className="flex-shrink-0">
              <Brand size="lg" />
            </div>
            <div className="hidden md:flex items-center justify-center flex-grow">
              <div className="flex items-center space-x-8">
                <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">Home</a>
                <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">Product</a>
                <a href="#venues-heading" className="text-sm text-white/70 hover:text-white transition-colors">Venues</a>
                <a href="#faq" className="text-sm text-white/70 hover:text-white transition-colors">FAQs</a>
              </div>
            </div>
            <div className="flex gap-4 flex-shrink-0">
              <Link href="/auth?tab=login">
                <Button variant="ghost" className="text-white/70 hover:text-white">
                  Log In
                </Button>
              </Link>
              <Link href="/auth?tab=register">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        aria-labelledby="hero-heading" 
        className="relative isolate px-4 sm:px-6 pt-28 lg:px-8"
      >
        {/* Simple background gradient */}
        <div className="absolute inset-x-0 top-0 -z-10 h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-30"></div>
        </div>

        <div className="mx-auto max-w-6xl py-10 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start mb-8">
                <div className="rounded-full bg-white/10 p-3 backdrop-blur-sm">
                  <Radio className="h-14 w-14 sm:h-16 sm:w-16 text-primary animate-pulse" aria-hidden="true" />
                </div>
              </div>
              <h1 id="hero-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight gradient-text animate-in slide-in-from-bottom-4 duration-1000">
                Elevate Your Venue with Interactive Music Experiences
              </h1>
              <p className="mt-6 text-base sm:text-lg leading-8 text-foreground/80 animate-in slide-in-from-bottom-5 duration-1000">
                Transform how your guests engage with your space by creating collaborative music experiences. Let them contribute to your venue's atmosphere in real-time, fostering deeper connections and memorable moments through shared musical discovery.
              </p>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 sm:gap-x-6 animate-in slide-in-from-bottom-6 duration-1000">
                <Link href="/auth?tab=register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 pulse-highlight">
                    <PlayCircle className="h-5 w-5" aria-hidden="true" />
                    <span>Sign Up</span>
                  </Button>
                </Link>
                <Link href="/auth?tab=login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 border-primary/20 hover:bg-primary/10">
                    <Share2 className="h-5 w-5" aria-hidden="true" />
                    <span>Log In</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right side - Player mockup */}
            <div className="hidden lg:block relative animate-in slide-in-from-right-6 duration-1000">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl" aria-hidden="true"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl" aria-hidden="true"></div>
              <PlayerMockup className="w-full max-w-md mx-auto transform rotate-2 shadow-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features"
        aria-labelledby="features-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 id="features-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
            Powerful Features
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-8 text-white/70 px-4 sm:px-0">
            Everything you need to create interactive music experiences
          </p>
        </div>

        {/* Tabs Component */}
        <div id="for-venues" className="mx-auto max-w-5xl rounded-xl overflow-hidden backdrop-blur-sm border border-white/10 bg-white/5">
          <div className="grid grid-cols-2">
            {/* Tab Headers */}
            <button 
              id="for-venues"
              className={`py-4 px-6 text-center transition-all duration-300 ${activeTab === 'hosts' ? 'bg-primary/10 border-b-2 border-primary' : 'bg-transparent hover:bg-white/5 border-b-2 border-white/10'}`}
              onClick={() => setActiveTab('hosts')}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <Building2 className={`h-6 w-6 ${activeTab === 'hosts' ? 'text-primary' : 'text-white/70'}`} />
                <span className={`text-base sm:text-lg font-medium ${activeTab === 'hosts' ? 'text-white' : 'text-white/70'}`}>For Venues & Hosts</span>
              </div>
            </button>
            
            <button 
              id="for-guests"
              className={`py-4 px-6 text-center transition-all duration-300 ${activeTab === 'guests' ? 'bg-primary/10 border-b-2 border-primary' : 'bg-transparent hover:bg-white/5 border-b-2 border-white/10'}`}
              onClick={() => setActiveTab('guests')}
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <Users2 className={`h-6 w-6 ${activeTab === 'guests' ? 'text-primary' : 'text-white/70'}`} />
                <span className={`text-base sm:text-lg font-medium ${activeTab === 'guests' ? 'text-white' : 'text-white/70'}`}>Guest Experience</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 sm:p-8">
            {/* Host Features Tab */}
            <div className={`transition-opacity duration-300 ${activeTab === 'hosts' ? 'block opacity-100' : 'hidden opacity-0'}`}>
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight gradient-text mb-4 text-center">
                  Create the Perfect Atmosphere
                </h3>
                <p className="text-base text-white/70 mb-4 max-w-3xl mx-auto text-center">
                  Take control of your venue's music with powerful tools designed specifically for hosts and venue owners. Our platform empowers you to create memorable experiences that keep your customers coming back.
                </p>
                <p className="text-base text-white/70 max-w-3xl mx-auto text-center">
                  With Local Tunes, you maintain complete control while still offering your guests an interactive experience they'll love.
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-x-6 lg:gap-x-8">
                {[
                  {
                    icon: ListMusic,
                    title: "Live Playlist Management",
                    description: "Search, add, and reorder songs dynamically"
                  },
                  {
                    icon: Share2,
                    title: "Unique Guest URL & QR Code",
                    description: "Easily share access with your audience"
                  },
                  {
                    icon: PlayCircle,
                    title: "YouTube Integration",
                    description: "Stream songs directly with seamless playback"
                  },
                  {
                    icon: History,
                    title: "History Tracking",
                    description: "Keep a record of all played songs"
                  },
                  {
                    icon: Music2,
                    title: "Saved Playlists",
                    description: "Create and reuse custom playlists for different events"
                  },
                  {
                    icon: Palette,
                    title: "Venue Customization",
                    description: "Personalize your branding and theme"
                  },
                  {
                    icon: ShieldCheck,
                    title: "Guest Controls",
                    description: "Set permissions for what guests can add or modify"
                  },
                  {
                    icon: Mic2,
                    title: "Karaoke Mode",
                    description: "Create interactive sing-along experiences with lyrics display"
                  },
                  {
                    icon: Headphones,
                    title: "Silent Parties",
                    description: "Allow guests to connect headphones for personal listening"
                  }
                ].map((feature) => (
                  <div key={feature.title} className="flex flex-col items-center text-center group hover:scale-105 transition-transform duration-200">
                    <dt>
                      <div className="mx-auto mb-4 sm:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                        <feature.icon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-semibold gradient-text">
                        {feature.title}
                      </h3>
                    </dt>
                    <dd className="mt-2 sm:mt-4 text-sm sm:text-base text-white/70 max-w-xs mx-auto">
                      {feature.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Guest Features Tab */}
            <div className={`transition-opacity duration-300 ${activeTab === 'guests' ? 'block opacity-100' : 'hidden opacity-0'}`}>
              <div className="mb-8">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight gradient-text mb-4 text-center">
                  Enhance Your Guests' Experience
                </h3>
                <p className="text-base text-white/70 mb-4 max-w-3xl mx-auto text-center">
                  Keep your guests engaged and happy by allowing them to participate in the music selection. This interactive experience creates a stronger connection to your venue and encourages repeat visits.
                </p>
                <p className="text-base text-white/70 max-w-3xl mx-auto text-center">
                  As the host, you still maintain full control over what plays, ensuring the atmosphere always matches your venue's vibe.
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-x-6 lg:gap-x-8">
                {[
                  {
                    icon: Music2,
                    title: "Add Songs to Playlist",
                    description: "Guests can search and suggest songs using YouTube - you decide what actually plays"
                  },
                  {
                    icon: Radio,
                    title: "Real-Time Interaction",
                    description: "Create an engaging atmosphere where guests contribute to the music experience"
                  },
                  {
                    icon: ThumbsUp,
                    title: "Vote for Songs",
                    description: "Let guests like or upvote songs to influence what plays next in the queue"
                  },
                  {
                    icon: PlayCircle,
                    title: "Embedded Player",
                    description: "Guests can listen to what's playing directly on their device while at your venue"
                  }
                ].map((feature) => (
                  <div key={feature.title} className="flex flex-col items-center text-center group hover:scale-105 transition-transform duration-200">
                    <dt>
                      <div className="mx-auto mb-4 sm:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                        <feature.icon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-semibold gradient-text">
                        {feature.title}
                      </h3>
                    </dt>
                    <dd className="mt-2 sm:mt-4 text-sm sm:text-base text-white/70 max-w-xs mx-auto">
                      {feature.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Venues & Occasions Section */}
      <section 
        aria-labelledby="venues-heading"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
      >
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 id="venues-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
            Perfect for Every Venue
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-8 text-white/70 px-4 sm:px-0">
            Local Tunes adapts to any environment where music enhances the experience
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              icon: Beer,
              title: "Bars & Pubs",
              description: "Let patrons influence the vibe while maintaining full control. Perfect for themed nights and happy hours."
            },
            {
              icon: Utensils,
              title: "Restaurants",
              description: "Create the perfect dining atmosphere with playlists that complement your cuisine and ambiance."
            },
            {
              icon: PartyPopper,
              title: "Events & Weddings",
              description: "Allow guests to request their favorite songs while keeping the celebration flowing smoothly."
            },
            {
              icon: Coffee,
              title: "Coffee Shops",
              description: "Build the perfect café atmosphere with collaborative playlists that evolve throughout the day."
            },
            {
              icon: ShoppingBag,
              title: "Retail Stores",
              description: "Enhance shopping experiences with music that resonates with your brand and customers."
            },
            {
              icon: Dumbbell,
              title: "Gyms & Fitness",
              description: "Keep energy levels high with dynamic playlists that members can contribute to during workouts."
            }
          ].map((venue) => (
            <div 
              key={venue.title}
              className="relative group hover:scale-105 transition-transform duration-200"
            >
              <div className="absolute inset-0 bg-primary/5 rounded-lg transform -skew-y-2 group-hover:bg-primary/10 transition-colors duration-200" />
              <div className="relative p-6 sm:p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-200">
                  <venue.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 gradient-text">
                  {venue.title}
                </h3>
                <p className="text-sm sm:text-base text-white/70">
                  {venue.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Perfect for Home Gatherings Section */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
            Create Unforgettable Home Experiences
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-8 text-white/70 px-4 sm:px-0">
            Transform your private gatherings with interactive music that brings everyone together
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              icon: PartyPopper,
              title: "House Parties",
              description: "Let your friends add songs to the playlist in real-time. No more arguments over who controls the music!"
            },
            {
              icon: Music2,
              title: "Karaoke Nights",
              description: "Create the ultimate singalong experience with collaborative playlists where everyone can queue up their favorite songs."
            },
            {
              icon: Users2,
              title: "Family Gatherings",
              description: "Give everyone a voice in choosing the soundtrack for your special family moments and celebrations."
            },
            {
              icon: Home,
              title: "Game Nights",
              description: "Set the perfect atmosphere with themed playlists that everyone can contribute to between rounds."
            },
            {
              icon: Headphones,
              title: "Silent Parties",
              description: "Host unique parties where everyone has their own headset but shares the same collaborative playlist experience."
            },
            {
              icon: Share2,
              title: "Remote Listening Parties",
              description: "Share your playlist with friends around the world and let them add songs even if they can't be there in person."
            }
          ].map((occasion) => (
            <div 
              key={occasion.title}
              className="relative group hover:scale-105 transition-transform duration-200"
            >
              <div className="absolute inset-0 bg-primary/5 rounded-lg transform skew-y-2 group-hover:bg-primary/10 transition-colors duration-200" />
              <div className="relative p-6 sm:p-8">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-200">
                  <occasion.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 gradient-text">
                  {occasion.title}
                </h3>
                <p className="text-sm sm:text-base text-white/70">
                  {occasion.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LocalQR Section */}
      <LocalQRHero />

      {/* FAQ Section */}
      <section id="faq" className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight gradient-text">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-8 text-white/70 px-4 sm:px-0">
            Everything you need to know about Local Tunes and how it works
          </p>
        </div>

        <div className="mx-auto max-w-3xl bg-white/5 rounded-xl p-4 sm:p-6 backdrop-blur-sm border border-white/10">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                How does Local Tunes work?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                Local Tunes allows hosts to create collaborative playlists where guests can contribute song suggestions in real-time. 
                The host maintains control over the playlist while guests can search and add songs from YouTube. 
                The player seamlessly streams music, creating an interactive experience for everyone.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                Do guests need to create an account?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                No, guests don't need to create accounts. Hosts can share a unique link or QR code that allows guests to access and contribute to the playlist instantly. This makes it easy for anyone to join in the music experience without any barriers.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                Can I use Local Tunes for commercial spaces?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                Absolutely! Local Tunes is perfect for bars, restaurants, cafes, retail stores, and other commercial venues. It enhances customer experience by allowing them to participate in the music selection while you maintain control over what actually plays.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                Is there a limit to how many songs guests can add?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                As a host, you have full control over playlist settings, including the ability to set limits on how many songs each guest can add. This helps ensure everyone gets a chance to contribute and prevents any single guest from dominating the playlist.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                Can I manage multiple playlists?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                Yes, you can create and manage multiple playlists for different events or occasions. Save your playlists to reuse them later or create themed playlists for specific events. Each playlist has its own unique access link for guests.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6" className="border-white/10">
              <AccordionTrigger className="text-base sm:text-lg font-medium text-white">
                What if I don't want to play a suggested song?
              </AccordionTrigger>
              <AccordionContent className="text-white/70">
                As the host, you maintain complete control over the playlist. You can approve songs before they're added to the queue, skip songs, reorder the playlist, or remove songs entirely. This ensures that the music always fits your desired atmosphere.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Add footer section */}
      <footer className="border-t border-white/10 mt-8 sm:mt-16 bg-[#121212]">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Stay Connected Section */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold gradient-text flex items-center gap-2">
                <Users2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Stay Connected
              </h3>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="text-white/70 hover:text-primary transition-colors p-2 -m-2"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="text-white/70 hover:text-primary transition-colors p-2 -m-2"
                  aria-label="Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  className="text-white/70 hover:text-primary transition-colors p-2 -m-2"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
              <p className="text-xs sm:text-sm text-white/70">
                Follow us for updates and exclusive features
              </p>
            </div>

            {/* Main Navigation */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold gradient-text flex items-center gap-2">
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Navigation
              </h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li>
                  <a href="#" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Home</a>
                </li>
                <li>
                  <a href="#features" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Product</a>
                </li>
                <li>
                  <a href="#venues-heading" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Venues</a>
                </li>
                <li>
                  <a href="#faq" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">FAQs</a>
                </li>
              </ul>
            </div>

            {/* Legal & Privacy Section */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold gradient-text flex items-center gap-2">
                <Book className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Legal & Privacy
              </h3>
              <ul className="space-y-1.5 sm:space-y-2">
                <li>
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Terms of Service</a>
                </li>
                <li>
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">Cookie Policy</a>
                </li>
                <li>
                  <Link href="/auth?tab=login&admin=true" className="text-xs sm:text-sm text-white/70 hover:text-primary transition-colors block py-1">
                    Super Admin
                  </Link>
                </li>
              </ul>
            </div>

            {/* Join the Community Section */}
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-semibold gradient-text">
                Join the Local Tunes Community
              </h3>
              <div className="space-y-6 sm:space-y-8">
                <p className="text-xs sm:text-sm text-white/70">
                  Be part of a growing network of music lovers collaborating live. Share your passion for music and create unforgettable experiences.
                </p>
                <Link href="/auth?tab=register">
                  <Button className="w-full sm:w-auto">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10 text-center">
            <p className="text-xs sm:text-sm text-white/70 flex items-center justify-center gap-2">
              Made with
              <Heart className="h-3 w-3 sm:h-4 sm:w-4 text-primary fill-primary animate-pulse" />
              on Earth
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}