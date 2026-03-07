import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WorldOverlay } from './SVGOverlays';
import { GridMapPattern } from './BackgroundPatterns';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/landingButton';

export default function FinalCTA() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClaim = () => {
    navigate('/register');
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden text-white" style={{ backgroundColor: '#3B82F6' }}>
      <GridMapPattern />
      <WorldOverlay />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center space-y-6 sm:space-y-8"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
            {t('sections.finalCTA.headline')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-100 max-w-3xl mx-auto">
            {t('sections.finalCTA.subtext')}
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">
            {/* QR Visual - no card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex flex-col items-center"
            >
              <img
                src="/images/earthqr.png"
                alt="QR code"
                className="w-64 h-56 sm:w-80 sm:h-72 object-contain rounded-lg [clip-path:inset(8%_0_0_0)]"
              />
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleClaim}
                  size="lg"
                  className="bg-white hover:bg-gray-100 font-bold text-lg shadow-xl text-[#1e3c15]"
                >
                  {t('sections.finalCTA.ctaButton')}
                </Button>
              </motion.div>
              <p className="text-blue-100 text-sm mt-3">
                {t('sections.finalCTA.disclaimer')}
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
