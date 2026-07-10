export type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type AddressResult = {
  street_name?: string;
  city?: string;
  administrative_area?: string;
  state?: string;
  country?: string;
  postal_code?: string;
};

export interface FormValues {
  username: string;
  accountName: string;
  accountType: string;
  bio?: string;
  category: string;
  primaryLocation: string;
  address: string;
}

export interface Places {
  address_components: AddressComponent[];
  types: string[];
  name: string;
  place_id?: string;
  formatted_phone_number?: string;
  formatted_address?: string;
  website?: string;
  rating?: number; // Fetched Google Maps place rating out of 5
  primaryType?: string; // Google Places primary type (e.g., "beach", "restaurant")
  primaryTypeDisplayName?: string; // Human-readable primary type (e.g., "Beach", "Restaurant")
  geometry?: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
}
