import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { GET_FAQS } from '../api/queries';

export type Faq = {
  locale: string;
  Question: string;
  Answer: string;
  Sequence: number;
};

export const useFaqs = () => {
  const { i18n } = useTranslation();
  const currentLocale = i18n.language;
  
  const { data, loading, error } = useQuery<{ faqs: Faq[] }>(GET_FAQS, {
    variables: { locale: currentLocale },
    fetchPolicy: 'cache-and-network', // Ensure fresh data when language changes
    notifyOnNetworkStatusChange: true,
  });

  const sortedFaqs = data?.faqs
    ? [...data.faqs].sort((a, b) => a.Sequence - b.Sequence)
    : [];

  return {
    faqs: sortedFaqs,
    loading,
    error
  };
}; 