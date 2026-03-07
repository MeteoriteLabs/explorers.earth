import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Testimonial } from '../types';
import { useTranslation } from 'react-i18next';

// Avatar URLs for testimonials
const testimonialAvatars = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // Indian woman
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // Indian man
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // Japanese man
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // Brazilian woman
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // Australian man
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120', // French woman
];

export default function Testimonials() {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Get translated testimonials data
  const testimonialsData = t('sections.testimonials.items', { returnObjects: true }) as any[];
  const testimonials: Testimonial[] = testimonialsData.map((item: any, index: number) => ({
    id: item.id,
    name: item.name,
    role: item.role,
    location: item.location,
    quote: item.quote,
    avatar: testimonialAvatars[index] || testimonialAvatars[0],
    rating: 5,
  }));

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 280;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  // Auto-scroll functionality
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const cardWidth = 280 + 24; // Card width + gap
        const totalWidth = cardWidth * testimonials.length;
        
        // If we've scrolled past the original set, reset to beginning
        if (container.scrollLeft >= totalWidth) {
          container.scrollLeft = 0;
        }
        
        // Continue scrolling
        container.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 3000); // Auto-scroll every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-12 sm:py-16 lg:py-20 text-white" style={{ backgroundColor: '#1F2937' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
            {t('sections.testimonials.headline')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
            {t('sections.testimonials.subtext')}
          </p>
        </motion.div>

        {/* Testimonials Carousel */}
        <div className="relative">
          <div
            ref={scrollContainerRef}
            className="flex space-x-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[...testimonials, ...testimonials.map(t => ({...t, id: `${t.id}-duplicate`}))].map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                whileHover={{ y: -4 }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.1,
                }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-4 sm:p-6 w-[280px] flex-shrink-0 shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={testimonial.avatar}
                      alt={`${testimonial.name} avatar`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-charcoal">{testimonial.name}</h4>
                      <p className="text-sm text-gray-500">
                        {testimonial.role}, {testimonial.location}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 italic">"{testimonial.quote}"</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Scroll buttons */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cta-blue"
            aria-label={t('sections.testimonials.scrollLeft')}
          >
            <ChevronLeft className="text-charcoal" size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-4 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cta-blue"
            aria-label={t('sections.testimonials.scrollRight')}
          >
            <ChevronRight className="text-charcoal" size={20} />
          </button>
        </div>
      </div>


    </section>
  );
}
