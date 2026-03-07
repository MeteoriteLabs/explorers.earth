import { motion } from 'framer-motion';
import { 
  QrCode,
  Edit3,
  MapPin,
  Music,
  Shield,
  Users
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: QrCode,
      title: t('sections.features.simpleLinks.title', { defaultValue: 'Simple links and QR sharing' }),
      color: 'hsl(var(--evergreen))'
    },
    {
      icon: Edit3,
      title: t('sections.features.livingGuides.title', { defaultValue: 'Living, editable guides' }),
      color: 'hsl(var(--evergreen))'
    },
    {
      icon: MapPin,
      title: t('sections.features.locationAware.title', { defaultValue: 'Location-aware recommendations' }),
      color: 'hsl(var(--evergreen))'
    },
    {
      icon: Music,
      title: t('sections.features.soundPlaylists.title', { defaultValue: 'Optional sound and playlists' }),
      color: 'hsl(var(--evergreen))'
    },
    {
      icon: Shield,
      title: t('sections.features.privacyFirst.title', { defaultValue: 'Privacy-first by design' }),
      color: 'hsl(var(--evergreen))'
    },
    {
      icon: Users,
      title: t('sections.features.communityDriven.title', { defaultValue: 'Community-driven discovery' }),
      color: 'hsl(var(--evergreen))'
    }
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-20" style={{ backgroundColor: '#F0EBE5' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-4 sm:mb-6 leading-tight">
            {t('sections.features.title', { defaultValue: 'Built to stay out of the way' })}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {t('sections.features.subtitle', { defaultValue: 'Simple, thoughtful features that let your recommendations shine.' })}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="bg-white rounded-xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100"
              >
                <div className="flex items-start space-x-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: feature.color + '15' }}
                  >
                    <IconComponent 
                      className="w-6 h-6" 
                      style={{ color: feature.color }}
                    />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-charcoal leading-tight">
                      {feature.title}
                    </h3>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

