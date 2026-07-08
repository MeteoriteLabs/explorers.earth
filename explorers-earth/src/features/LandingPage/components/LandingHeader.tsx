import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navItems = [
    { label: t('header.nav.product'), sectionId: 'product' },
    { label: t('header.nav.howItWorks'), sectionId: 'how-it-works' },
    { label: t('header.nav.share'), sectionId: 'share' },
    { label: t('header.nav.faq'), sectionId: 'faq' },
  ];

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

  const hasSolidHeader = isScrolled || isNonHomePage || isMobileMenuOpen;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed left-3 right-3 top-4 z-50 mx-auto max-w-[1060px] rounded-full border transition-all duration-300 ${
        hasSolidHeader
          ? 'border-white/60 bg-[#fbf7ef]/92 text-[#17231a] shadow-[0_16px_48px_rgba(23,35,26,0.13)] backdrop-blur-xl'
          : 'border-white/60 bg-[#fbf7ef]/78 text-[#17231a] shadow-[0_16px_48px_rgba(23,35,26,0.12)] backdrop-blur-xl'
      }`}
    >
      <div className="px-4 py-3 sm:px-5">
        <nav className="flex items-center justify-between gap-4">
          {/* Logo */}
          <button 
            onClick={() => scrollToSection('hero')}
            className="flex items-center transition-opacity hover:opacity-75"
          >
            <span className="text-lg font-black tracking-[-0.02em] sm:text-xl">
              explorers.earth
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-5 rounded-full bg-transparent p-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.sectionId}
                onClick={() => scrollToSection(item.sectionId)}
                className="rounded-full px-1 py-2 text-sm font-bold text-[#17231a]/75 transition-colors hover:text-[#17231a]"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={() => setIsLanguageModalOpen(true)}
              className="flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-medium transition-colors hover:bg-black/5"
            >
              <Globe size={16} />
              <span className="hidden sm:inline">{i18n.language.toUpperCase()}</span>
              <ChevronDown size={12} />
            </button>

            {/* Auth Buttons */}
            <div className="hidden items-center gap-2 md:flex">
              <button 
                onClick={() => handleAuthButtonClick('/login')}
                className="rounded-full border border-[rgba(23,35,26,.18)] bg-[#fffcf6] px-4 py-2 text-sm font-extrabold text-[#1b3b1a] transition-all hover:bg-[#f6f1e7]"
              >
                {t('header.auth.login')}
              </button>
              <button 
                onClick={() => handleAuthButtonClick('/register')}
                className="landing-green-button rounded-full px-4 py-2 text-sm font-extrabold transition-all"
              >
                {t('header.auth.claimFreePage')}
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={
                isMobileMenuOpen
                  ? t('header.nav.closeMenu')
                  : t('header.nav.openMenu')
              }
              className="rounded-full p-2 transition-colors hover:bg-black/5 lg:hidden"
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
            className="mt-4 overflow-hidden rounded-[22px] bg-[#fffcf6] shadow-lg lg:hidden"
          >
            <div className="p-4 space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.sectionId}
                  onClick={() => scrollToSection(item.sectionId)}
                  className="block w-full text-left text-[#17231a] transition-colors hover:text-[#1b3b1a]"
                >
                  {item.label}
                </button>
              ))}
              <hr className="border-gray-200" />
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleAuthButtonClick('/login')}
                  className="flex-1 rounded-full border border-[#17231a] px-4 py-2 text-[#17231a] transition-all hover:bg-[#17231a] hover:text-white">
                  {t('header.auth.login')}
                </button>
                <button 
                  onClick={() => handleAuthButtonClick('/register')}
                  className="landing-green-button flex-1 rounded-full px-4 py-2 text-white"
                >
                  {t('header.auth.claimFree')}
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
