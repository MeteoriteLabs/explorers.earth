import { FC } from "react";

interface AvatarPlaceholderProps {
  className?: string;
}

const AvatarPlaceholder: FC<AvatarPlaceholderProps> = ({ className = "" }) => {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background */}
      <rect width="400" height="400" fill="#1a1a1a" />
      
      {/* Avatar Circle Background */}
      <circle cx="200" cy="160" r="70" fill="#2a2a2a" />
      
      {/* Head */}
      <circle cx="200" cy="160" r="50" fill="#3a3a3a" />
      
      {/* Body/Shoulders */}
      <ellipse cx="200" cy="320" rx="100" ry="80" fill="#3a3a3a" />
      
      {/* Accent circle for visual interest */}
      <circle cx="200" cy="200" r="120" fill="none" stroke="#2a2a2a" strokeWidth="2" opacity="0.3" />
    </svg>
  );
};

export default AvatarPlaceholder;
