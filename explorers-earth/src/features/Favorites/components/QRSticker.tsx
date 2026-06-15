import { FC, LegacyRef } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "../../../components/ui/QRCode";
import { useCityStore } from "../../../store/useCityStore";

interface QRStickerProps {
  qrCodeUrl: string;
  qrRef: LegacyRef<HTMLDivElement>;
}

const QRSticker: FC<QRStickerProps> = ({ qrCodeUrl, qrRef }) => {
  const { t } = useTranslation();
  const { selectedCity } = useCityStore();

  return (
    <div
      ref={qrRef}
      className="rounded-2xl overflow-hidden border-[1.5px] border-white flex flex-col w-full max-w-[210px] mx-auto shadow-2xl bg-black"
    >
      {/* Black header */}
      <div className="bg-black py-2.5 px-2 text-center border-b border-white/5">
        <span className="text-white text-[10px] font-bold tracking-wide uppercase">
          My Recommendations
        </span>
      </div>
      {/* Photo background with QR code overlay */}
      <div
        className="h-[180px] bg-cover bg-center flex flex-col items-center justify-between p-3 relative"
        style={{
          backgroundImage: `url(${selectedCity?.List_Name_Details?.thumbnail})`,
        }}
      >
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />

        {/* QR Container */}
        <div className="bg-white rounded-xl p-1.5 inline-block relative shadow-lg mt-1 z-10">
          <QRCode
            value={qrCodeUrl}
            size="medium"
            style={{ height: "85px", width: "85px" }}
          />
          {/* Logo overlay in center of QR */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black rounded px-1.5 py-0.5 flex items-center justify-center border border-white shadow-md">
            <span className="text-[6px] font-black text-white uppercase tracking-wider">
              Explorers
            </span>
          </div>
        </div>
        
        {/* Pill overlay at bottom */}
        <div className="bg-white/95 text-slate-900 rounded-full px-3 py-1 text-[9px] font-extrabold shadow-md mb-0.5 z-10">
          {t("dashboard.recommendations.travelLikeLocal")}
        </div>
      </div>
    </div>
  );
};

export default QRSticker;
