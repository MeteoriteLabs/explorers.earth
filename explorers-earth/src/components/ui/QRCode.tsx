import { FC } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  getQRSizeConfig,
  generateLogoImageSettings,
  QRSize,
} from "../../utils/qrCodeService";

interface QRCodeProps {
  value: string;
  size?: QRSize;
  level?: "L" | "M" | "Q" | "H";
  className?: string;
  style?: React.CSSProperties;
  // Logo configuration options
  includeLogo?: boolean; // Option to include/exclude logo
  logoSrc?: string; // Custom logo source (overrides default)
  logoSize?: { width: number; height: number }; // Custom logo size
}

const QRCode: FC<QRCodeProps> = ({
  value,
  size = "medium",
  level = "H",
  className,
  style,
  includeLogo = true, // Include logo by default
  logoSrc,
  logoSize,
  ...props
}) => {
  const sizeConfig = getQRSizeConfig(size);

  const combinedClassName = className
    ? `${sizeConfig.className} ${className}`
    : sizeConfig.className;

  const combinedStyle = style
    ? { ...sizeConfig.style, ...style }
    : sizeConfig.style;

  // Prepare image settings for logo
  const imageSettings = includeLogo
    ? generateLogoImageSettings(size, logoSize, logoSrc)
    : undefined;

  return (
    <QRCodeCanvas
      value={value}
      size={sizeConfig.size}
      level={level}
      className={combinedClassName}
      style={combinedStyle}
      imageSettings={imageSettings}
      {...props}
    />
  );
};

export default QRCode;
