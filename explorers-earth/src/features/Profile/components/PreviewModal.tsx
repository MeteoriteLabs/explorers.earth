import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import MobileIcon from "../../../assets/icons/MobileIcon";
import WhatsappIcon from "../../../assets/icons/WhatsappIcon";
import InstagramIcon from "../../../assets/icons/InstagramIcon";

import MonitorIcon from "../../../assets/icons/MonitorIcon";
import BoldLinkIcon from "../../../assets/icons/BoldLinkIcon";
import { IMAGE_CONFIG } from "../../../config";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedBackground?: string;
  uploadedImage?: string;
  userData: {
    bgPicture: string;
    profilePicture: string;
    username: string;
    accountType: string;
    bio: string;
    city: string;
    country: string;
    instagramLink?: string;
    mobilenumberLink?: string;
    whatsappLink?: string;
    explorersLink?: string;
  };
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  uploadedBackground,
  uploadedImage,
  userData,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"mobile" | "desktop">("mobile");

  if (!isOpen) return null;

  return (
    <div className="fixed w-full inset-0 bg-dashboard-overlay backdrop-blur-sm z-[150] flex items-center justify-center">
      <div
        className="relative rounded-lg max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex flex-col items-center"
        style={{ width: "90vw", height: "90vh" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex flex-col w-full items-center gap-2">
          {/* View Toggle */}
          <div className="hidden md:flex gap-1 p-1 bg-gray-100 rounded-full">
            <button
              onClick={() => setViewMode("mobile")}
              className={`flex items-center gap-2 font-poppins px-2 py-1 rounded-full transition-all ${viewMode === "mobile"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <MobileIcon fill={"none"} color="#4b5563" />
              <span className="text-sm font-medium">Mobile</span>
            </button>
            <button
              onClick={() => setViewMode("desktop")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${viewMode === "desktop"
                ? "bg-white text-gray-900 shadow-md"
                : "text-gray-600 hover:text-gray-900"
                }`}
            >
              <MonitorIcon stroke="#4b5563" />
              <span className="text-sm font-medium">Desktop</span>
            </button>
          </div>

          {/* Device Frame */}
          <div
            className={`flex items-center mt-16 md:mt-0 justify-center transition-all duration-300 ${viewMode === "mobile"
              ? "w-[280px] h-[540px]" // Optimized mobile dimensions
              : "w-[800px] h-[500px]" // Optimized desktop dimensions
              }`}
          >
            <div
              className={`relative h-full w-full bg-dashboard-sidebar overflow-hidden shadow-dashboard-elevated ${viewMode === "mobile"
                ? "rounded-[3rem] border-[6px] border-black"
                : "rounded-2xl border border-dashboard"
                }`}
            >
              {/* Mobile Notch */}
              {viewMode === "mobile" && (
                <div className="absolute top-0 z-50 left-1/2 -translate-x-1/2 w-32 h-6 bg-dashboard-sidebar rounded-b-3xl flex items-center justify-center">
                  <div className="w-16 h-4 bg-dashboard-sidebar rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-dashboard-sidebar rounded-full"></div>
                  </div>
                </div>
              )}

              {viewMode === "mobile" && (
                <div className="absolute -bottom-1 h-6 left-[20%]  rounded-b-3xl flex items-center justify-center">
                  <div className="w-40 h-2 bg-dashboard-sidebar rounded-full flex items-center justify-center"></div>
                </div>
              )}

              {/* Content Container */}
              <div className="h-full overflow-auto preview-scroll">
                {/* Cover Image */}
                <div className="relative h-40">
                  <img
                    src={
                      uploadedBackground ||
                      userData.bgPicture ||
                      IMAGE_CONFIG.defaultImages.background
                    }
                    alt={t('dashboard.profile.common.cover')}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-dashboard-sidebar/20"></div>
                </div>

                {/* Profile Content */}
                <div className="px-4 py-6">
                  {/* Profile Picture */}
                  <div className="relative -mt-14 mb-4">
                    <div className="w-[5rem] h-[5rem] mx-auto rounded-full border-4 border-dashboard-sidebar overflow-hidden">
                      <img
                        src={uploadedImage || userData.profilePicture}
                        alt={t('dashboard.profile.common.profile')}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="text-center ">
                    <h2 className="text-sm font-poppins font-semibold text-white">
                      {userData.username}
                    </h2>
                    <h2 className="text-xs font-poppins font-light my-1 text-[hsl(var(--text-light))]">
                      {userData.accountType}
                    </h2>
                    <div className="text-[hsl(var(--muted-foreground))] text-xs font-poppins">
                      📍 {userData.city}, {userData.country}
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="mt-6 flex justify-center gap-4">
                    {userData.instagramLink && <InstagramIcon color="white" />}
                    {userData.mobilenumberLink && <MobileIcon fill="white" />}
                    {userData.whatsappLink && <WhatsappIcon fill="white" />}
                    {userData.explorersLink && <BoldLinkIcon color="white" />}
                  </div>

                  <div className="mt-8">
                    <h2 className="text-sm  font-poppins font-semibold text-white">
                      Bio
                    </h2>
                    <div
                      className="text-[hsl(var(--text-light))] font-poppins  text-xs"
                      dangerouslySetInnerHTML={{ __html: userData.bio }}
                    />
                  </div>

                  <div className="mt-8 flex flex-row gap-2 items-center">
                    <MobileIcon />
                    <p className=" font-poppins text-white text-sm">
                      {userData.mobilenumberLink}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
