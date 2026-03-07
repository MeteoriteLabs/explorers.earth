import { useState, useEffect } from 'react';
import { motion, AnimatePresence, easeInOut } from 'framer-motion';
import { Link, Printer, BookOpen, QrCode } from 'lucide-react';
import { TravelPathPattern } from './BackgroundPatterns';
import { useTranslation } from 'react-i18next';

const STOREFRONT_IMAGES = ['/landing/storefront-1.png', '/landing/storefront-2.png', '/landing/storefront-3.png'];
const PROFILE_IMAGES = ['/landing/profile-1.png', '/landing/profile-2.png', '/landing/profile-3.png'];
const CAROUSEL_INTERVAL_MS = 4500;

// Storefront: slide + fade
const storefrontVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};
const storefrontTransition = { duration: 0.5, ease: easeInOut };

// Profile: flip + move
const profileVariants = {
  initial: { opacity: 0, rotateY: -90, y: 20 },
  animate: { opacity: 1, rotateY: 0, y: 0 },
  exit: { opacity: 0, rotateY: 90, y: -20 },
};
const profileTransition = { duration: 0.45, ease: easeInOut };

export default function ShareAnywhere() {
  const { t } = useTranslation();
  const [storefrontIndex, setStorefrontIndex] = useState(0);
  const [profileIndex, setProfileIndex] = useState(0);

  useEffect(() => {
    const storefrontTimer = setInterval(() => {
      setStorefrontIndex((prev) => (prev + 1) % STOREFRONT_IMAGES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(storefrontTimer);
  }, []);

  useEffect(() => {
    const profileTimer = setInterval(() => {
      setProfileIndex((prev) => (prev + 1) % PROFILE_IMAGES.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(profileTimer);
  }, []);

  return (
    <section className="relative overflow-hidden text-white pt-12 pb-12 sm:pt-8 sm:pb-8 lg:py-10" style={{ backgroundColor: 'hsl(var(--evergreen))' }}>
      <div className="floating-background">
        <TravelPathPattern />
      </div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          {/* Visual: same width for all 4 images, shape preserved, no cropping */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] mx-auto flex flex-col items-center gap-3"
          >
            {/* Storefront display carousel — same width as profile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="w-full"
            >
              <div className="relative w-full rounded-2xl overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={storefrontIndex}
                    src={STOREFRONT_IMAGES[storefrontIndex]}
                    alt={t('sections.shareAnywhere.storefrontText')}
                    className="block w-full h-auto rounded-2xl"
                    initial={storefrontVariants.initial}
                    animate={storefrontVariants.animate}
                    exit={storefrontVariants.exit}
                    transition={storefrontTransition}
                  />
                </AnimatePresence>
              </div>
              <p className="text-white text-sm mt-2 text-center">{t('sections.shareAnywhere.storefrontText')}</p>
              <div className="flex justify-center gap-1.5 mt-1.5">
                {STOREFRONT_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`View storefront ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === storefrontIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                    onClick={() => setStorefrontIndex(i)}
                  />
                ))}
              </div>
            </motion.div>

            {/* Instagram / TikTok profile carousel — same width as storefront */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="w-full"
            >
              <div className="relative w-full rounded-2xl overflow-hidden" style={{ perspective: '1000px' }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={profileIndex}
                    src={PROFILE_IMAGES[profileIndex]}
                    alt="Explorer profile"
                    className="block w-full h-auto rounded-2xl"
                    initial={profileVariants.initial}
                    animate={profileVariants.animate}
                    exit={profileVariants.exit}
                    transition={profileTransition}
                  />
                </AnimatePresence>
              </div>
              <p className="text-white text-sm mt-2 text-center w-full">{t('sections.shareAnywhere.profileCarouselCaption')}</p>
              <div className="flex justify-center gap-1.5 mt-1.5">
                {PROFILE_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`View profile ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === profileIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                    onClick={() => setProfileIndex(i)}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-white space-y-4 sm:space-y-6 sm:-ml-4 lg:-ml-6 sm:-mt-4 lg:-mt-6 max-lg:order-1 lg:order-2 max-lg:mt-0 max-lg:ml-0 min-w-0"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              {t('sections.shareAnywhere.headline')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 leading-relaxed">
              {t('sections.shareAnywhere.subtext')}
            </p>
            
            {/* Bullet Points */}
            <div className="space-y-4 mt-4 sm:mt-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <QrCode className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">{t('sections.shareAnywhere.qrEverywhereTitle')}</h4>
                  <p className="text-gray-300">{t('sections.shareAnywhere.qrEverywhereDesc')}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <Link className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">{t('sections.shareAnywhere.instagramTitle')}</h4>
                  <p className="text-gray-300">{t('sections.shareAnywhere.instagramDesc')}</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <Printer className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">{t('sections.shareAnywhere.menuTitle')}</h4>
                  <p className="text-gray-300">{t('sections.shareAnywhere.menuDesc')}</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <BookOpen className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">{t('sections.shareAnywhere.welcomeTitle')}</h4>
                  <p className="text-gray-300">{t('sections.shareAnywhere.welcomeDesc')}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
