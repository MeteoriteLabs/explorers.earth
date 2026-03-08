// QR Code related constants and configurations

export const QR_CONSTANTS = {
  // Default QR code settings
  DEFAULT_LEVEL: 'H' as const,
  DEFAULT_SIZE: 'medium' as const,

  // File naming patterns
  FILENAME_PATTERN: {
    PROFILE: (username: string, citySlug?: string) =>
      citySlug ? `${username}-${citySlug}.png` : `${username}.png`,
    GENERIC: 'qr-code.png'
  },

  // Error messages
  MESSAGES: {
    DOWNLOAD_SUCCESS: 'QR code downloaded successfully!',
    DOWNLOAD_ERROR: 'Failed to download QR code. Please try again.',
    COPY_SUCCESS: 'Link copied to clipboard!',
    COPY_ERROR: 'Failed to copy link. Please try again.',
    QR_NOT_READY: 'QR code not ready for download'
  },

  // Share text templates
  SHARE_TEMPLATES: {
    PROFILE: {
      title: 'explorers Profile',
      text: 'Check out my explorers profile'
    },
    RECOMMENDATIONS: {
      title: 'explorers Recommendations',
      text: 'Check out my travel recommendations'
    }
  }
} as const;

export type QRLevel = 'L' | 'M' | 'Q' | 'H';
