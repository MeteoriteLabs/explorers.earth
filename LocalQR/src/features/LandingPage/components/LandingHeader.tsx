import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../store/store';
import LanguageModal from '../../../components/LanguageModal';

export default function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  const scrollToSection = (sectionId: string) => {
    // If we're not on the home page, navigate to home first
    if (location.pathname !== '/') {
      window.location.href = `/#${sectionId}`;
      return;
    }
    
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  // Check if we're on a non-home page to always show background
  const isNonHomePage = location.pathname !== '/';

  // Handle authentication button clicks
  const handleAuthButtonClick = (route: string) => {
    if (isAuthenticated) {
      // If user is logged in, redirect to dashboard
      navigate('/home');
    } else {
      // If user is not logged in, navigate to the specified route
      navigate(route);
    }
  };

  // Handle language change
  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4 overflow-hidden ${
        isScrolled || isNonHomePage ? 'bg-white shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between overflow-hidden">
          {/* Logo */}
          <button 
            onClick={() => scrollToSection('hero')}
            className="flex items-center transition-opacity hover:opacity-75"
          >
            <span className={`text-xl font-bold transition-colors ${
              isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
            }`}>
              explorers.earth
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className={`transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              {t('header.nav.howItWorks')}
            </button>
            <button
              onClick={() => scrollToSection('who-is-for')}
              className={`transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              {t('header.nav.whoIsFor')}
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className={`transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              {t('header.nav.faq')}
            </button>
            <Link
              to="/about"
              className={`transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              {t('header.nav.about')}
            </Link>
            <Link
              to="/contact"
              className={`transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              {t('header.nav.contact')}
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <button
              onClick={() => setIsLanguageModalOpen(true)}
              className={`flex items-center space-x-1 transition-colors hover:opacity-75 ${
                isScrolled || isNonHomePage ? 'text-charcoal' : 'text-white'
              }`}
            >
              <Globe size={16} />
              <span className="text-sm">{i18n.language.toUpperCase()}</span>
              <ChevronDown size={12} />
            </button>            {/* Auth Buttons */}
            <div className="hidden md:flex items-center space-x-3">
              <button 
                onClick={() => handleAuthButtonClick('/login')}
                className={`px-4 py-2 border rounded-lg transition-all ${
                  isScrolled || isNonHomePage
                    ? 'border-charcoal text-charcoal hover:bg-charcoal hover:text-white' 
                    : 'border-white text-white hover:bg-white hover:text-charcoal'
                }`}>
                {t('header.auth.login')}
              </button>
              <button 
                onClick={() => handleAuthButtonClick('/register')}
                className="px-4 py-2 text-white rounded-lg"
                style={{ backgroundColor: 'hsl(var(--blue-cta))' }}
              >
                {t('header.auth.signUp')}
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden transition-colors ${
                isScrolled ? 'text-charcoal' : 'text-white'
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white shadow-lg mt-4 rounded-lg overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="block w-full text-left text-charcoal hover:text-cta-blue transition-colors"
              >
                {t('header.nav.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('who-is-for')}
                className="block w-full text-left text-charcoal hover:text-cta-blue transition-colors"
              >
                {t('header.nav.whoIsFor')}
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="block w-full text-left text-charcoal hover:text-cta-blue transition-colors"
              >
                {t('header.nav.faq')}
              </button>
              <Link
                to="/about"
                className="block text-charcoal hover:text-cta-blue transition-colors"
              >
                {t('header.nav.about')}
              </Link>
              <Link
                to="/contact"
                className="block text-charcoal hover:text-cta-blue transition-colors"
              >
                {t('header.nav.contact')}
              </Link>
              <hr className="border-gray-200" />
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleAuthButtonClick('/login')}
                  className="flex-1 px-4 py-2 border border-charcoal text-charcoal rounded-lg hover:bg-charcoal hover:text-white transition-all">
                  {t('header.auth.login')}
                </button>
                <button 
                  onClick={() => handleAuthButtonClick('/register')}
                  className="flex-1 px-4 py-2 text-white rounded-lg"
                  style={{ backgroundColor: 'hsl(var(--blue-cta))' }}
                >
                  {t('header.auth.signUp')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Language Modal */}
      <LanguageModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        currentLanguage={i18n.language}
        onLanguageChange={handleLanguageChange}
      />
    </motion.header>
  );
}
