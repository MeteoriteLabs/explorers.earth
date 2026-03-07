import { memo } from "react";
import Settings from "../features/Settings/Settings";
import SEO from "../components/SEO";
import { createCanonicalUrl } from "../utils/getCurrentDomain";

const SettingsPage = memo(() => {
  return (
    <>
      <SEO
        title="Settings - explorers Account Settings"
        description="Customize your explorers account settings including privacy preferences, notification controls, and security options to keep your profile safe and tailored to your needs."
        keywords={[
          "explorers account settings",
          "manage privacy settings",
          "notification preferences",
          "account security options",
          "user settings explorers",
          "profile customization",
          "explorers privacy control",
          "user preferences management",
          "secure account settings",
          "dashboard configuration",
          "explorers security settings",
          "notification management",
          "personal settings explorers",
          "user account controls",
          "explorers preferences",
          'explorers settings',
          'account settings',
          'user preferences',
          'privacy settings',
          'notification settings',
          'account security',
          'explorers preferences',
          'user configuration',
          'dashboard settings'
        ]}
        canonical={createCanonicalUrl("/settings")}
        type="website"
        noIndex={true}
      />

      <Settings />
    </>
  );
});

export default SettingsPage;
