import React from "react";
import { useTranslation } from "react-i18next";

interface UsernameChangeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  newUsername: string;
  cooldownDays: number; // Can be fractional for testing (e.g., 1/1440 for 1 minute)
}

/**
 * Username Change Confirmation Modal
 *
 * Purpose: Shows a warning modal when users attempt to change their username,
 * informing them about the impact on their profile links and QR codes.
 *
 * Cooldown Integration: The modal displays the current cooldown period (configurable)
 * and warns users they won't be able to change username again for that duration.
 *
 * Links Impact: Dynamically shows how their new username will affect:
 * - Profile URL: explorers.earth/{newUsername}
 * - Places list URL: explorers.earth/{newUsername}/places
 */
const UsernameChangeConfirmationModal: React.FC<
  UsernameChangeConfirmationModalProps
> = ({ isOpen, onClose, onConfirm, newUsername, cooldownDays }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-gray-50 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-800 mb-3">
            {t('modal.usernameChange.title')}
          </h2>
          <div className="text-sm text-gray-600 space-y-3">
            <p>
              {t('modal.usernameChange.description')}
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>
                <span className="font-medium">{t('modal.usernameChange.profileLabel')}</span>{" "}
                <code className="bg-gray-200 px-1 rounded text-xs text-gray-700">
                  explorers.earth/{newUsername}
                </code>
              </li>
              <li>
                <span className="font-medium">{t('modal.usernameChange.listLabel')}</span>{" "}
                <code className="bg-gray-200 px-1 rounded text-xs text-gray-700">
                  explorers.earth/{newUsername}/places
                </code>
              </li>
            </ul>
            <p className="text-gray-600">
              {t('modal.usernameChange.warning')}
            </p>
            <p className="text-gray-700">
              {t('modal.usernameChange.cooldownPrefix')}{" "}
              {cooldownDays < 1
                ? t('modal.usernameChange.minute')
                : cooldownDays === 1
                  ? t('modal.usernameChange.day')
                  : `${cooldownDays} ${t('modal.usernameChange.days')}`}{" "}
              {t('modal.usernameChange.cooldownSuffix')}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          >
            {t('modal.usernameChange.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors"
          >
            {t('modal.usernameChange.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsernameChangeConfirmationModal;
