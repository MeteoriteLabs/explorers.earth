import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Country {
  code: string;
  name: string;
  flag: string;
  callingCode: string;
}

// Countries with their phone codes - sorted alphabetically
export const countries: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', callingCode: '+93' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', callingCode: '+355' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', callingCode: '+213' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩', callingCode: '+376' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴', callingCode: '+244' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', callingCode: '+54' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', callingCode: '+374' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', callingCode: '+61' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', callingCode: '+43' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', callingCode: '+994' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭', callingCode: '+973' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', callingCode: '+880' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾', callingCode: '+375' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', callingCode: '+32' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿', callingCode: '+501' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯', callingCode: '+229' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', callingCode: '+975' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', callingCode: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦', callingCode: '+387' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', callingCode: '+267' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', callingCode: '+55' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', callingCode: '+673' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', callingCode: '+359' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', callingCode: '+226' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', callingCode: '+257' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭', callingCode: '+855' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', callingCode: '+237' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', callingCode: '+1' },
  { code: 'CV', name: 'Cape Verde', flag: '🇨🇻', callingCode: '+238' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫', callingCode: '+236' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩', callingCode: '+235' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', callingCode: '+56' },
  { code: 'CN', name: 'China', flag: '🇨🇳', callingCode: '+86' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', callingCode: '+57' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲', callingCode: '+269' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', callingCode: '+242' },
  { code: 'CD', name: 'Congo, Democratic Republic', flag: '🇨🇩', callingCode: '+243' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', callingCode: '+506' },
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮', callingCode: '+225' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', callingCode: '+385' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', callingCode: '+53' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾', callingCode: '+357' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', callingCode: '+420' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', callingCode: '+45' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', callingCode: '+253' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲', callingCode: '+1' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', callingCode: '+1' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', callingCode: '+593' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', callingCode: '+20' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', callingCode: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶', callingCode: '+240' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷', callingCode: '+291' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', callingCode: '+372' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', callingCode: '+251' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯', callingCode: '+679' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', callingCode: '+358' },
  { code: 'FR', name: 'France', flag: '🇫🇷', callingCode: '+33' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', callingCode: '+241' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲', callingCode: '+220' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', callingCode: '+995' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', callingCode: '+49' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', callingCode: '+233' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', callingCode: '+30' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩', callingCode: '+1' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', callingCode: '+502' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳', callingCode: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼', callingCode: '+245' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', callingCode: '+592' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', callingCode: '+509' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', callingCode: '+504' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', callingCode: '+36' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸', callingCode: '+354' },
  { code: 'IN', name: 'India', flag: '🇮🇳', callingCode: '+91' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', callingCode: '+62' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', callingCode: '+98' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶', callingCode: '+964' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', callingCode: '+353' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', callingCode: '+972' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', callingCode: '+39' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', callingCode: '+1' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', callingCode: '+81' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴', callingCode: '+962' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', callingCode: '+7' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', callingCode: '+254' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮', callingCode: '+686' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵', callingCode: '+850' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', callingCode: '+82' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', callingCode: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬', callingCode: '+996' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦', callingCode: '+856' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', callingCode: '+371' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧', callingCode: '+961' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', callingCode: '+266' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷', callingCode: '+231' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾', callingCode: '+218' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮', callingCode: '+423' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', callingCode: '+370' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', callingCode: '+352' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', callingCode: '+261' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', callingCode: '+265' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', callingCode: '+60' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻', callingCode: '+960' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', callingCode: '+223' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹', callingCode: '+356' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭', callingCode: '+692' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷', callingCode: '+222' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺', callingCode: '+230' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', callingCode: '+52' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲', callingCode: '+691' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', callingCode: '+373' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨', callingCode: '+377' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳', callingCode: '+976' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', callingCode: '+382' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', callingCode: '+212' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', callingCode: '+258' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', callingCode: '+95' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', callingCode: '+264' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷', callingCode: '+674' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', callingCode: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', callingCode: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', callingCode: '+64' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', callingCode: '+505' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', callingCode: '+227' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', callingCode: '+234' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', callingCode: '+47' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲', callingCode: '+968' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', callingCode: '+92' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼', callingCode: '+680' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', callingCode: '+507' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬', callingCode: '+675' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', callingCode: '+595' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', callingCode: '+51' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', callingCode: '+63' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', callingCode: '+48' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', callingCode: '+351' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', callingCode: '+974' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', callingCode: '+40' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', callingCode: '+7' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', callingCode: '+250' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳', callingCode: '+1' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨', callingCode: '+1' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨', callingCode: '+1' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', callingCode: '+685' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲', callingCode: '+378' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹', callingCode: '+239' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', callingCode: '+966' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', callingCode: '+221' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', callingCode: '+381' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', callingCode: '+248' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', callingCode: '+232' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', callingCode: '+65' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', callingCode: '+421' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮', callingCode: '+386' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧', callingCode: '+677' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴', callingCode: '+252' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', callingCode: '+27' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸', callingCode: '+211' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', callingCode: '+34' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', callingCode: '+94' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩', callingCode: '+249' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', callingCode: '+597' },
  { code: 'SZ', name: 'Swaziland', flag: '🇸🇿', callingCode: '+268' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', callingCode: '+46' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', callingCode: '+41' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾', callingCode: '+963' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', callingCode: '+886' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯', callingCode: '+992' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', callingCode: '+255' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', callingCode: '+66' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', callingCode: '+670' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', callingCode: '+228' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', callingCode: '+676' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹', callingCode: '+1' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳', callingCode: '+216' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', callingCode: '+90' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲', callingCode: '+993' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻', callingCode: '+688' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', callingCode: '+256' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', callingCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', callingCode: '+971' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', callingCode: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', callingCode: '+1' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', callingCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', callingCode: '+998' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', callingCode: '+678' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦', callingCode: '+379' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', callingCode: '+58' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', callingCode: '+84' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪', callingCode: '+967' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', callingCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', callingCode: '+263' },
];

interface CountryCodeDropdownProps {
  selectedCountry: Country | null;
  onCountryChange: (country: Country) => void;
  disabled?: boolean;
  theme?: 'light' | 'dark';
}

const CountryCodeDropdown: React.FC<CountryCodeDropdownProps> = ({
  selectedCountry,
  onCountryChange,
  disabled = false,
  theme = 'light',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isAbove, setIsAbove] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Get the button element
      const button = buttonRef.current;
      if (!button) return;
      
      // Check if click is on the button
      if (button.contains(target)) {
        return; // Don't close if clicking on the button
      }
      
      // Check if click is on the dropdown by looking for elements with our data attribute
      const clickedDropdown = target.closest('[data-country-dropdown]');
      if (clickedDropdown) {
        return; // Don't close if clicking on the dropdown
      }
      
      // If we get here, the click was outside both button and dropdown
      console.log('Closing dropdown - outside click detected');
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('Closing dropdown - escape pressed');
        setIsOpen(false);
      }
    };

    // Use capture phase to catch clicks early
    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Filter countries based on search term
  const filteredCountries = countries.filter(country =>
    country.callingCode.includes(searchTerm) ||
    country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize window size
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  // Calculate dropdown position with boundary detection
  const calculateDropdownPosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = windowSize.width < 640 ? 280 : 360;
      const dropdownHeight = windowSize.width < 640 ? 240 : 400;
      
      let left = buttonRect.left;
      let top;
      
      // Calculate space above and below the button
      const spaceAbove = buttonRect.top;
      const spaceBelow = windowSize.height - buttonRect.bottom;
      
      // Adjust horizontal position if dropdown would go off-screen
      if (left + dropdownWidth > windowSize.width) {
        left = windowSize.width - dropdownWidth - 10; // 10px margin from edge
      }
      
      // Determine vertical position: prefer above if there's enough space, otherwise below
      if (spaceAbove >= dropdownHeight + 10) {
        // Show above the button if there's sufficient space
        top = buttonRect.top - dropdownHeight - 4;
        setIsAbove(true);
      } else if (spaceBelow >= dropdownHeight + 10) {
        // Show below the button if there's sufficient space
        top = buttonRect.bottom + 4;
        setIsAbove(false);
      } else {
        // If neither has enough space, choose the side with more space
        if (spaceAbove > spaceBelow) {
          top = buttonRect.top - dropdownHeight - 4;
          setIsAbove(true);
        } else {
          top = buttonRect.bottom + 4;
          setIsAbove(false);
        }
      }
      
      // Ensure dropdown doesn't go above the viewport
      if (top < 10) {
        top = 10;
        setIsAbove(false);
      }
      
      setDropdownPosition({ top, left });
    }
  };

  // Close dropdown when clicking outside and update position on scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        calculateDropdownPosition();
      }
    };

    const handleResize = () => {
      if (isOpen) {
        calculateDropdownPosition();
      }
    };

    // Add a more frequent position update for smooth following
    let animationFrameId: number;
    let lastPosition = { top: 0, left: 0 };
    const handlePositionUpdate = () => {
      if (isOpen) {
        const buttonRect = buttonRef.current?.getBoundingClientRect();
        if (buttonRect) {
          const newTop = isAbove ? buttonRect.top - (windowSize.width < 640 ? 240 : 400) - 4 : buttonRect.bottom + 4;
          const newLeft = buttonRect.left;
          
          // Only update if position has changed significantly (more than 1px)
          if (Math.abs(newTop - lastPosition.top) > 1 || Math.abs(newLeft - lastPosition.left) > 1) {
            calculateDropdownPosition();
            lastPosition = { top: newTop, left: newLeft };
          }
        }
        animationFrameId = requestAnimationFrame(handlePositionUpdate);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    
    // Start continuous position updates when dropdown is open
    if (isOpen) {
      animationFrameId = requestAnimationFrame(handlePositionUpdate);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, windowSize]);

  const handleCountrySelect = (country: Country) => {
    onCountryChange(country);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggleDropdown = () => {
    if (!disabled) {
      if (!isOpen) {
        calculateDropdownPosition();
      }
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={handleToggleDropdown}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border border-dashboard rounded-l-md text-left text-sm
          focus:outline-none focus:ring-2 focus:ring-purple focus:border-purple
          flex items-center justify-between min-w-[80px]
          ${theme === 'dark' 
            ? `${disabled ? 'bg-dashboard-muted cursor-not-allowed' : 'bg-dashboard-muted hover:border-dashboard-accent text-dashboard'}`
            : `${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-purple'}`
          }
        `}
      >
        <div className="flex items-center space-x-1">
          <span className="text-sm">{selectedCountry?.flag || '🇮🇳'}</span>
          <span className={`text-xs font-mono ${theme === 'dark' ? 'text-dashboard-light' : 'text-gray-700'}`}>
            {selectedCountry?.callingCode || '+91'}
          </span>
        </div>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dashboard-light' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          data-country-dropdown
          className={`country-dropdown-menu fixed bg-white border border-gray-300 shadow-lg overflow-hidden ${
            isAbove ? 'rounded-b-md' : 'rounded-t-md'
          }`}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 99999,
            width: windowSize.width < 640 ? '280px' : '360px', // 280px for small screens, 360px for larger
            maxHeight: windowSize.width < 640 ? '240px' : '400px', // 240px for small screens, 400px for larger
            minWidth: '280px',
            maxWidth: windowSize.width < 640 ? '90vw' : '400px' // Responsive max width
          }}
        >
          {/* Arrow indicator */}
          <div 
            className={`absolute w-0 h-0 border-l-4 border-r-4 border-l-transparent border-r-transparent ${
              isAbove ? 'border-t-4 border-t-gray-300 bottom-0 left-4' : 'border-b-4 border-b-gray-300 top-0 left-4'
            }`}
          />
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple focus:border-purple ${
                windowSize.width < 640 ? 'text-xs' : 'text-sm'
              } bg-white text-gray-700 placeholder:text-gray-500`}
              autoFocus
            />
          </div>
          <div 
            className="overflow-y-auto scrollbar-hide"
            style={{
              maxHeight: windowSize.width < 640 ? '180px' : '320px' // 180px for small screens, 320px for larger
            }}
          >
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => handleCountrySelect(country)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-3
                    ${selectedCountry?.code === country.code ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}
                    ${windowSize.width < 640 ? 'text-xs' : 'text-sm'}
                  `}
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="flex-1 truncate font-mono">{country.callingCode}</span>
                  <span className="text-gray-500 truncate hidden sm:block">{country.name}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-xs text-gray-500 text-center">
                No countries found
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CountryCodeDropdown;
