import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface CountryOption {
  value: string;
  label: string;
  phoneCode: string;
}

// Common countries first, then alphabetical list
export const countries: CountryOption[] = [
  { value: 'us', label: 'United States', phoneCode: '+1' },
  { value: 'ca', label: 'Canada', phoneCode: '+1' },
  { value: 'gb', label: 'United Kingdom', phoneCode: '+44' },
  { value: 'au', label: 'Australia', phoneCode: '+61' },
  { value: 'in', label: 'India', phoneCode: '+91' },
  { value: 'af', label: 'Afghanistan', phoneCode: '+93' },
  { value: 'al', label: 'Albania', phoneCode: '+355' },
  { value: 'dz', label: 'Algeria', phoneCode: '+213' },
  { value: 'ad', label: 'Andorra', phoneCode: '+376' },
  { value: 'ao', label: 'Angola', phoneCode: '+244' },
  { value: 'ar', label: 'Argentina', phoneCode: '+54' },
  { value: 'am', label: 'Armenia', phoneCode: '+374' },
  { value: 'at', label: 'Austria', phoneCode: '+43' },
  { value: 'az', label: 'Azerbaijan', phoneCode: '+994' },
  { value: 'bh', label: 'Bahrain', phoneCode: '+973' },
  { value: 'bd', label: 'Bangladesh', phoneCode: '+880' },
  { value: 'by', label: 'Belarus', phoneCode: '+375' },
  { value: 'be', label: 'Belgium', phoneCode: '+32' },
  { value: 'bz', label: 'Belize', phoneCode: '+501' },
  { value: 'br', label: 'Brazil', phoneCode: '+55' },
  { value: 'bn', label: 'Brunei', phoneCode: '+673' },
  { value: 'bg', label: 'Bulgaria', phoneCode: '+359' },
  { value: 'kh', label: 'Cambodia', phoneCode: '+855' },
  { value: 'cm', label: 'Cameroon', phoneCode: '+237' },
  { value: 'cn', label: 'China', phoneCode: '+86' },
  { value: 'co', label: 'Colombia', phoneCode: '+57' },
  { value: 'hr', label: 'Croatia', phoneCode: '+385' },
  { value: 'cy', label: 'Cyprus', phoneCode: '+357' },
  { value: 'cz', label: 'Czech Republic', phoneCode: '+420' },
  { value: 'dk', label: 'Denmark', phoneCode: '+45' },
  { value: 'eg', label: 'Egypt', phoneCode: '+20' },
  { value: 'ee', label: 'Estonia', phoneCode: '+372' },
  { value: 'fi', label: 'Finland', phoneCode: '+358' },
  { value: 'fr', label: 'France', phoneCode: '+33' },
  { value: 'de', label: 'Germany', phoneCode: '+49' },
  { value: 'gh', label: 'Ghana', phoneCode: '+233' },
  { value: 'gr', label: 'Greece', phoneCode: '+30' },
  { value: 'hk', label: 'Hong Kong', phoneCode: '+852' },
  { value: 'hu', label: 'Hungary', phoneCode: '+36' },
  { value: 'is', label: 'Iceland', phoneCode: '+354' },
  { value: 'id', label: 'Indonesia', phoneCode: '+62' },
  { value: 'ir', label: 'Iran', phoneCode: '+98' },
  { value: 'iq', label: 'Iraq', phoneCode: '+964' },
  { value: 'ie', label: 'Ireland', phoneCode: '+353' },
  { value: 'il', label: 'Israel', phoneCode: '+972' },
  { value: 'it', label: 'Italy', phoneCode: '+39' },
  { value: 'jm', label: 'Jamaica', phoneCode: '+1876' },
  { value: 'jp', label: 'Japan', phoneCode: '+81' },
  { value: 'jo', label: 'Jordan', phoneCode: '+962' },
  { value: 'kz', label: 'Kazakhstan', phoneCode: '+7' },
  { value: 'ke', label: 'Kenya', phoneCode: '+254' },
  { value: 'kr', label: 'Korea, South', phoneCode: '+82' },
  { value: 'kw', label: 'Kuwait', phoneCode: '+965' },
  { value: 'la', label: 'Laos', phoneCode: '+856' },
  { value: 'lv', label: 'Latvia', phoneCode: '+371' },
  { value: 'lb', label: 'Lebanon', phoneCode: '+961' },
  { value: 'lt', label: 'Lithuania', phoneCode: '+370' },
  { value: 'lu', label: 'Luxembourg', phoneCode: '+352' },
  { value: 'my', label: 'Malaysia', phoneCode: '+60' },
  { value: 'mv', label: 'Maldives', phoneCode: '+960' },
  { value: 'mt', label: 'Malta', phoneCode: '+356' },
  { value: 'mx', label: 'Mexico', phoneCode: '+52' },
  { value: 'md', label: 'Moldova', phoneCode: '+373' },
  { value: 'mc', label: 'Monaco', phoneCode: '+377' },
  { value: 'mn', label: 'Mongolia', phoneCode: '+976' },
  { value: 'me', label: 'Montenegro', phoneCode: '+382' },
  { value: 'ma', label: 'Morocco', phoneCode: '+212' },
  { value: 'mm', label: 'Myanmar', phoneCode: '+95' },
  { value: 'np', label: 'Nepal', phoneCode: '+977' },
  { value: 'nl', label: 'Netherlands', phoneCode: '+31' },
  { value: 'nz', label: 'New Zealand', phoneCode: '+64' },
  { value: 'ng', label: 'Nigeria', phoneCode: '+234' },
  { value: 'no', label: 'Norway', phoneCode: '+47' },
  { value: 'om', label: 'Oman', phoneCode: '+968' },
  { value: 'pk', label: 'Pakistan', phoneCode: '+92' },
  { value: 'pa', label: 'Panama', phoneCode: '+507' },
  { value: 'pg', label: 'Papua New Guinea', phoneCode: '+675' },
  { value: 'py', label: 'Paraguay', phoneCode: '+595' },
  { value: 'pe', label: 'Peru', phoneCode: '+51' },
  { value: 'ph', label: 'Philippines', phoneCode: '+63' },
  { value: 'pl', label: 'Poland', phoneCode: '+48' },
  { value: 'pt', label: 'Portugal', phoneCode: '+351' },
  { value: 'qa', label: 'Qatar', phoneCode: '+974' },
  { value: 'ro', label: 'Romania', phoneCode: '+40' },
  { value: 'ru', label: 'Russia', phoneCode: '+7' },
  { value: 'sa', label: 'Saudi Arabia', phoneCode: '+966' },
  { value: 'sn', label: 'Senegal', phoneCode: '+221' },
  { value: 'rs', label: 'Serbia', phoneCode: '+381' },
  { value: 'sg', label: 'Singapore', phoneCode: '+65' },
  { value: 'sk', label: 'Slovakia', phoneCode: '+421' },
  { value: 'si', label: 'Slovenia', phoneCode: '+386' },
  { value: 'za', label: 'South Africa', phoneCode: '+27' },
  { value: 'es', label: 'Spain', phoneCode: '+34' },
  { value: 'lk', label: 'Sri Lanka', phoneCode: '+94' },
  { value: 'se', label: 'Sweden', phoneCode: '+46' },
  { value: 'ch', label: 'Switzerland', phoneCode: '+41' },
  { value: 'tw', label: 'Taiwan', phoneCode: '+886' },
  { value: 'tj', label: 'Tajikistan', phoneCode: '+992' },
  { value: 'th', label: 'Thailand', phoneCode: '+66' },
  { value: 'tr', label: 'Turkey', phoneCode: '+90' },
  { value: 'tm', label: 'Turkmenistan', phoneCode: '+993' },
  { value: 'ua', label: 'Ukraine', phoneCode: '+380' },
  { value: 'ae', label: 'United Arab Emirates', phoneCode: '+971' },
  { value: 'uy', label: 'Uruguay', phoneCode: '+598' },
  { value: 'uz', label: 'Uzbekistan', phoneCode: '+998' },
  { value: 've', label: 'Venezuela', phoneCode: '+58' },
  { value: 'vn', label: 'Vietnam', phoneCode: '+84' },
  { value: 'ye', label: 'Yemen', phoneCode: '+967' },
  { value: 'zm', label: 'Zambia', phoneCode: '+260' },
  { value: 'zw', label: 'Zimbabwe', phoneCode: '+263' },
];

interface CountrySelectProps {
  value: string;
  onChange: (value: string, code: string) => void;
}

export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  
  // Find the selected country
  const selectedCountry = countries.find(country => 
    country.value === value || country.phoneCode === value
  );
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full bg-white text-black"
          style={{ color: 'black', backgroundColor: 'white' }}
        >
          {selectedCountry 
            ? `${selectedCountry.label} (${selectedCountry.phoneCode})` 
            : "Select country..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command className="bg-white rounded-md">
          <CommandInput placeholder="Search country..." className="text-black bg-white" />
          <CommandEmpty className="text-black bg-white">No country found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto bg-white">
            {countries.map((country) => (
              <CommandItem
                key={country.value}
                value={country.value}
                onSelect={() => {
                  onChange(country.value, country.phoneCode);
                  setOpen(false);
                }}
                className="text-black bg-white hover:bg-gray-100 aria-selected:bg-gray-100"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    (value === country.value || value === country.phoneCode) ? "opacity-100" : "opacity-0"
                  )}
                />
                {country.label} ({country.phoneCode})
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}