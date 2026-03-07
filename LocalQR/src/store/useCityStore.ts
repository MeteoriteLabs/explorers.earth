import { create } from "zustand";

export interface Recommendation {
  title: string;
  image: string;
  rating: number;
  reviews: number;
}

export interface City {
  imageUrl: string;
  alt: string;
  recommendations: Recommendation[];
}

export interface selectedCity {
  account?: {
    documentId: string;
  };
  slug?: string;
  List_Name?: string;
  documentId?: string;
  Visibility?: boolean;
  createdAt?: string;
  List_Name_Details?: {
    note?: string;
    thumbnail?: string;
    place_id?: string;
    location?: {
      latitude: string | number;
      longitude: string | number;
    };
  };
  Instagram_Media_URL?: string;
  recommended_places?: {
    documentId: string;
  }[];
  recommendations?: Recommendation[];
}

interface CityStore {
  selectedCity: selectedCity | null;
  setSelectedCity: (city: selectedCity | null) => void;
}

export const useCityStore = create<CityStore>((set) => ({
  selectedCity: null,
  setSelectedCity: (city) => set({ selectedCity: city }),
}));
