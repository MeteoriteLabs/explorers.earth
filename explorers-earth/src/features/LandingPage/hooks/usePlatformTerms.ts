import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { GET_PLATFORM_TERMS } from '../api/queries';

export type PlatformTerms = {
  Terms_and_Condition: any[];
  Privacy_and_Policy: any[];
  Cookie_Policy: any[];
};

export const usePlatformTerms = () => {
  const { i18n } = useTranslation();
  const currentLocale = i18n.language;
  
  const { data, loading, error } = useQuery<{ platformTerms: PlatformTerms[] }>(GET_PLATFORM_TERMS, {
    variables: { locale: currentLocale },
    fetchPolicy: 'cache-and-network', // Ensure fresh data when language changes
    notifyOnNetworkStatusChange: true,
  });

  return {
    terms: data?.platformTerms[0]?.Terms_and_Condition || [],
    privacy: data?.platformTerms[0]?.Privacy_and_Policy || [],
    cookies: data?.platformTerms[0]?.Cookie_Policy || [],
    loading,
    error
  };
}; 