import { motion } from 'framer-motion';
import { BarChart3, Eye, Globe } from 'lucide-react';
import { AnalyticsOverlay } from './SVGOverlays';
import { useTranslation } from 'react-i18next';

export default function Analytics() {
  const { t } = useTranslation();

  return (
    <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden" style={{ backgroundColor: '#E3EEF1' }}>
      <AnalyticsOverlay />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-gray-900 space-y-6"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              {t('sections.analytics.headline')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-700 leading-relaxed">
              {t('sections.analytics.subtext')}
            </p>
            
            {/* Bullet Points */}
            <div className="space-y-4 mt-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <BarChart3 className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">{t('sections.analytics.workingTitle')}</h4>
                  <p className="text-gray-700">{t('sections.analytics.workingDesc')}</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <Eye className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">{t('sections.analytics.scanningTitle')}</h4>
                  <p className="text-gray-700">{t('sections.analytics.scanningDesc')}</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                viewport={{ once: true }}
                className="flex items-start space-x-3"
              >
                <Globe className="text-blue-400 w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">{t('sections.analytics.spotsTitle')}</h4>
                  <p className="text-gray-700">{t('sections.analytics.spotsDesc')}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Analytics Chart UI */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-white rounded-xl shadow-2xl p-6"
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-charcoal">{t('sections.analytics.dashboardTitle')}</h3>
                <span className="text-sm text-gray-500">{t('sections.analytics.last30Days')}</span>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  viewport={{ once: true }}
                  className="bg-gray-50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-cta-blue">1,247</div>
                  <div className="text-xs text-gray-500">{t('sections.analytics.totalScans')}</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  viewport={{ once: true }}
                  className="bg-gray-50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-emerald-500">84%</div>
                  <div className="text-xs text-gray-500">{t('sections.analytics.engagement')}</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  viewport={{ once: true }}
                  className="bg-gray-50 rounded-lg p-4 text-center"
                >
                  <div className="text-2xl font-bold text-orange-500">23</div>
                  <div className="text-xs text-gray-500">{t('sections.analytics.referrals')}</div>
                </motion.div>
              </div>

              {/* Chart */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                viewport={{ once: true }}
                className="h-32 bg-white rounded-lg flex items-end justify-center space-x-2 p-4 border-2 border-gray-200"
              >
                {[60, 80, 40, 90, 70, 100, 55].map((height, index) => (
                  <motion.div
                    key={index}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${height}%` }}
                    transition={{ delay: 1 + index * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="w-6 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md shadow-lg"
                    style={{ minHeight: '8px' }}
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
