import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User,
  Star,
  Home,
  Store,
  Building,
  Plane,
  MapPin,
  Users,
  GraduationCap,
  Globe,
  Shield,
  BookOpen,
  Video,
  Camera,
  Bed,
  Palmtree,
  Utensils,
  Coffee,
  ShoppingBag,
  Dumbbell,
  Scissors,
  HeartPulse,
  Train,
  Heart,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Fallback emoji icon component
const EmojiIcon = ({ emoji, className }: { emoji: string; className?: string }) => (
  <span className={className} style={{ fontSize: '18px', lineHeight: '1' }}>{emoji}</span>
);

interface ModalItem {
  icon: React.ComponentType<any> | string;
  label: string;
  oneLiner: string;
  color: string;
  isEmoji?: boolean;
}

interface CardData {
  id: string;
  title: string;
  oneLiner: string;
  icon: React.ComponentType<any>;
  color: string;
  modalItems: ModalItem[];
}

// Helper function to get card data with translations
const getCardsData = (t: any): CardData[] => [
  {
    id: '1',
    title: t('sections.whoIsFor.cards.individuals.title'),
    oneLiner: t('sections.whoIsFor.cards.individuals.oneLiner'),
    icon: User,
    color: 'bg-blue-500',
    modalItems: [
      { icon: Plane, label: t('sections.whoIsFor.cards.individuals.items.traveler.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.traveler.oneLiner'), color: 'bg-blue-500' },
      { icon: MapPin, label: t('sections.whoIsFor.cards.individuals.items.local.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.local.oneLiner'), color: 'bg-green-500' },
      { icon: Users, label: t('sections.whoIsFor.cards.individuals.items.family.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.family.oneLiner'), color: 'bg-yellow-500' },
      { icon: '🎓', label: t('sections.whoIsFor.cards.individuals.items.student.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.student.oneLiner'), color: 'bg-purple-500', isEmoji: true },
      { icon: Globe, label: t('sections.whoIsFor.cards.individuals.items.nomad.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.nomad.oneLiner'), color: 'bg-cyan-500' },
      { icon: Shield, label: t('sections.whoIsFor.cards.individuals.items.emergencySharer.label'), oneLiner: t('sections.whoIsFor.cards.individuals.items.emergencySharer.oneLiner'), color: 'bg-orange-500' }
    ]
  },
  {
    id: '2',
    title: t('sections.whoIsFor.cards.creators.title'),
    oneLiner: t('sections.whoIsFor.cards.creators.oneLiner'),
    icon: Star,
    color: 'bg-pink-500',
    modalItems: [
      { icon: Star, label: t('sections.whoIsFor.cards.creators.items.influencer.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.influencer.oneLiner'), color: 'bg-pink-500' },
      { icon: '📝', label: t('sections.whoIsFor.cards.creators.items.blogger.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.blogger.oneLiner'), color: 'bg-purple-500', isEmoji: true },
      { icon: Video, label: t('sections.whoIsFor.cards.creators.items.vlogger.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.vlogger.oneLiner'), color: 'bg-red-500' },
      { icon: Star, label: t('sections.whoIsFor.cards.creators.items.reviewer.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.reviewer.oneLiner'), color: 'bg-yellow-500' },
      { icon: Camera, label: t('sections.whoIsFor.cards.creators.items.photographer.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.photographer.oneLiner'), color: 'bg-cyan-500' },
      { icon: BookOpen, label: t('sections.whoIsFor.cards.creators.items.educator.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.educator.oneLiner'), color: 'bg-blue-500' },
      { icon: Users, label: t('sections.whoIsFor.cards.creators.items.communityLeader.label'), oneLiner: t('sections.whoIsFor.cards.creators.items.communityLeader.oneLiner'), color: 'bg-green-500' }
    ]
  },
  {
    id: '3',
    title: t('sections.whoIsFor.cards.hospitality.title'),
    oneLiner: t('sections.whoIsFor.cards.hospitality.oneLiner'),
    icon: Home,
    color: 'bg-green-500',
    modalItems: [
      { icon: Building, label: t('sections.whoIsFor.cards.hospitality.items.hotel.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.hotel.oneLiner'), color: 'bg-yellow-500' },
      { icon: Home, label: t('sections.whoIsFor.cards.hospitality.items.airbnb.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.airbnb.oneLiner'), color: 'bg-green-500' },
      { icon: Bed, label: t('sections.whoIsFor.cards.hospitality.items.hostel.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.hostel.oneLiner'), color: 'bg-blue-500' },
      { icon: '🏠', label: t('sections.whoIsFor.cards.hospitality.items.homestay.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.homestay.oneLiner'), color: 'bg-purple-500', isEmoji: true },
      { icon: Palmtree, label: t('sections.whoIsFor.cards.hospitality.items.resort.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.resort.oneLiner'), color: 'bg-teal-500' },
      { icon: Building, label: t('sections.whoIsFor.cards.hospitality.items.pgColiving.label'), oneLiner: t('sections.whoIsFor.cards.hospitality.items.pgColiving.oneLiner'), color: 'bg-orange-500' }
    ]
  },
  {
    id: '4',
    title: t('sections.whoIsFor.cards.businesses.title'),
    oneLiner: t('sections.whoIsFor.cards.businesses.oneLiner'),
    icon: Store,
    color: 'bg-orange-500',
    modalItems: [
      { icon: Utensils, label: t('sections.whoIsFor.cards.businesses.items.restaurant.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.restaurant.oneLiner'), color: 'bg-orange-500' },
      { icon: Coffee, label: t('sections.whoIsFor.cards.businesses.items.cafe.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.cafe.oneLiner'), color: 'bg-amber-700' },
      { icon: ShoppingBag, label: t('sections.whoIsFor.cards.businesses.items.retailShop.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.retailShop.oneLiner'), color: 'bg-pink-500' },
      { icon: Dumbbell, label: t('sections.whoIsFor.cards.businesses.items.gym.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.gym.oneLiner'), color: 'bg-green-500' },
      { icon: '🌿', label: t('sections.whoIsFor.cards.businesses.items.spa.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.spa.oneLiner'), color: 'bg-purple-500', isEmoji: true },
      { icon: Scissors, label: t('sections.whoIsFor.cards.businesses.items.salon.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.salon.oneLiner'), color: 'bg-rose-500' },
      { icon: HeartPulse, label: t('sections.whoIsFor.cards.businesses.items.clinic.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.clinic.oneLiner'), color: 'bg-blue-500' },
      { icon: ShoppingBag, label: t('sections.whoIsFor.cards.businesses.items.boutique.label'), oneLiner: t('sections.whoIsFor.cards.businesses.items.boutique.oneLiner'), color: 'bg-yellow-500' }
    ]
  },
  {
    id: '5',
    title: t('sections.whoIsFor.cards.organizations.title'),
    oneLiner: t('sections.whoIsFor.cards.organizations.oneLiner'),
    icon: Building,
    color: 'bg-yellow-500',
    modalItems: [
      { icon: Plane, label: t('sections.whoIsFor.cards.organizations.items.airline.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.airline.oneLiner'), color: 'bg-blue-500' },
      { icon: '🏢', label: t('sections.whoIsFor.cards.organizations.items.agency.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.agency.oneLiner'), color: 'bg-purple-500', isEmoji: true },
      { icon: GraduationCap, label: t('sections.whoIsFor.cards.organizations.items.university.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.university.oneLiner'), color: 'bg-slate-700' },
      { icon: Building, label: t('sections.whoIsFor.cards.organizations.items.corporate.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.corporate.oneLiner'), color: 'bg-gray-600' },
      { icon: Plane, label: t('sections.whoIsFor.cards.organizations.items.airport.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.airport.oneLiner'), color: 'bg-teal-500' },
      { icon: Train, label: t('sections.whoIsFor.cards.organizations.items.railway.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.railway.oneLiner'), color: 'bg-red-500' },
      { icon: Heart, label: t('sections.whoIsFor.cards.organizations.items.ngo.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.ngo.oneLiner'), color: 'bg-green-500' },
      { icon: Shield, label: t('sections.whoIsFor.cards.organizations.items.government.label'), oneLiner: t('sections.whoIsFor.cards.organizations.items.government.oneLiner'), color: 'bg-amber-600' }
    ]
  }
];

interface WhoForModalProps {
  card: CardData | null;
  isOpen: boolean;
  onClose: () => void;
}

function WhoForModal({ card, isOpen, onClose }: WhoForModalProps) {
  if (!card) return null;

  const IconComponent = card.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
            className="bg-white rounded-xl shadow-2xl max-w-[29rem] sm:max-w-md w-full max-h-[85vh] overflow-y-auto border border-gray-100 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 ${card.color} rounded-full mx-auto flex items-center justify-center mb-4`}>
                  <IconComponent className="text-white" size={24} />
                </div>
                <h3 className="text-xl font-semibold text-charcoal mb-2">{card.title}</h3>
              </div>
              
              <div className="space-y-2">
                {card.modalItems.map((item, index) => {
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                        {item.isEmoji && typeof item.icon === 'string' ? (
                          <EmojiIcon emoji={item.icon} />
                        ) : (
                          (() => {
                            const ItemIcon = item.icon as React.ComponentType<any>;
                            return <ItemIcon className="text-white" size={18} />;
                          })()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-charcoal text-sm mb-1">{item.label}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{item.oneLiner}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function WhoIsFor() {
  const { t } = useTranslation();
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cardsData = getCardsData(t);

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedCard(null), 300);
  };

  return (
    <section id="who-is-for" className="py-12 sm:py-16 lg:py-20" style={{ backgroundColor: 'hsl(var(--soft-off-white))' }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-charcoal mb-4 sm:mb-6">
            {t('sections.whoIsFor.headline')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('sections.whoIsFor.subtext')}
          </p>
        </motion.div>

        {/* Grid of use cases */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {cardsData.map((card, index) => {
            const IconComponent = card.icon;
            
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.1,
                }}
                viewport={{ once: true }}
                className="bg-white rounded-xl p-6 sm:p-7 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => handleCardClick(card)}
              >
                <div className="text-center space-y-4">
                  <div className={`w-16 h-16 ${card.color} rounded-full mx-auto flex items-center justify-center`}>
                    <IconComponent className="text-white" size={24} />
                  </div>
                  <h3 className="font-semibold text-charcoal text-base sm:text-lg">{card.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{card.oneLiner}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <WhoForModal 
        card={selectedCard} 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
      />
    </section>
  );
}
