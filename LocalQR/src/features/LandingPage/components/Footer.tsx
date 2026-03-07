import { QrCode, Instagram, Twitter, Linkedin } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GlobePattern } from './BackgroundPatterns';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = (sectionId: string) => {
    if (location.pathname === '/') {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(`/#${sectionId}`);
    }
  };

  return (
    <footer className="py-16 relative overflow-hidden" style={{ backgroundColor: '#1A1A1A' }}>
      <GlobePattern />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-cta-blue rounded-lg flex items-center justify-center">
                <QrCode className="text-white" size={16} />
              </div>
              <span className="text-xl font-bold text-white">explorers</span>
            </div>
            <p className="text-gray-400">{t('footer.tagline')}</p>
            <div className="flex space-x-4">
              <a
                href="https://www.instagram.com/explorers_earth/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">{t('footer.sections.product')}</h3>
            <div className="space-y-2">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.faq')}
              </button>
              <Link
                to="/contact"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.contact')}
              </Link>
              <Link
                to="/about"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.about')}
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">{t('footer.sections.contact')}</h3>
            <div className="space-y-2">
              <a
                href={`mailto:${t('footer.email')}`}
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.email')}
              </a>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">{t('footer.sections.legal')}</h3>
            <div className="space-y-2">
              <Link
                to="/terms"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.terms')}
              </Link>
              <Link
                to="/privacy"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.privacy')}
              </Link>
              <Link
                to="/cookies"
                className="block text-gray-400 hover:text-white transition-colors"
              >
                {t('footer.links.cookies')}
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 text-center space-y-2">
          <p className="text-gray-400">{t('footer.copyright')}</p>
          <p className="text-gray-500 text-sm">{t('footer.madeWithLove')} <span className="text-green-500">♥</span></p>
        </div>
      </div>
    </footer>
  );
}
