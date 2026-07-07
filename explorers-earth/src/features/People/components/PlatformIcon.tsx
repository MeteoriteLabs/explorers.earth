import React from "react";
import {
  Instagram,
  Linkedin,
  Github,
  Youtube,
  Globe,
  Link as LinkIcon,
} from "lucide-react";
import { PersonPlatform } from "../utils/personHelpers";

interface PlatformIconProps {
  platform: PersonPlatform;
  className?: string;
  size?: number;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = "",
  size = 14,
}) => {
  if (!platform) return null;

  switch (platform) {
    case "instagram":
      return <Instagram size={size} className={`text-pink-400 ${className}`} />;
    case "linkedin":
      return <Linkedin size={size} className={`text-blue-400 ${className}`} />;
    case "x":
    case "twitter":
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="currentColor"
          className={`text-slate-300 ${className}`}
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "github":
      return <Github size={size} className={`text-gray-300 ${className}`} />;
    case "youtube":
      return <Youtube size={size} className={`text-red-400 ${className}`} />;
    case "website":
      return <Globe size={size} className={`text-teal-400 ${className}`} />;
    default:
      return <LinkIcon size={size} className={`text-slate-400 ${className}`} />;
  }
};

export default PlatformIcon;
