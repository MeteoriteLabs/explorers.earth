import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../features/LandingPage/components/ui/landingButton';
import { motion } from 'framer-motion';
import Footer from '../features/LandingPage/components/Footer';

interface StaticPageLayoutProps {
  children: ReactNode;
  title: string;
}

export default function StaticPageLayout({ children, title }: StaticPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <Link to="/">
            <Button
              variant="ghost"
              className="flex items-center space-x-2 text-charcoal hover:text-cta-blue"
            >
              <ArrowLeft size={20} />
              <span>Return to Home</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8"
        >
          <h1 className="text-4xl font-bold text-charcoal mb-8">{title}</h1>
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
