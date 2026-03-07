import { gql } from '@apollo/client';

export const GET_PLATFORM_TERMS = gql`
  query PlatformTerms($locale: I18NLocaleCode) {
    platformTerms(locale: $locale) {
      Terms_and_Condition
      Privacy_and_Policy
      Cookie_Policy
    }
  }
`;

export const GET_FAQS = gql`
  query Faqs($locale: I18NLocaleCode) {
    faqs(locale: $locale) {
      locale
      Question
      Answer
      Sequence
    }
  }
`; 