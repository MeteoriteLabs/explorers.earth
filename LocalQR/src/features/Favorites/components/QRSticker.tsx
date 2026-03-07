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
      className="flex relative flex-col justify-between items-center h-[16rem] p-6 bg-black border-2 text-white rounded-lg"
      ref={qrRef}
    >
      <div
        className="absolute bottom-0 left-0 w-full h-1/2 rounded-b-lg bg-cover bg-center"
        style={{
          backgroundImage: `url(${selectedCity?.List_Name_Details?.thumbnail})`,
        }}
      />
      <p className="text-sm mb-2">
        {t("dashboard.recommendations.myRecommendationsQR")}
      </p>

      <div className="z-10 items-center flex flex-col">
        <div className="p-2  bg-white  rounded-lg shadow-md">
          <QRCode
            value={qrCodeUrl}
            size="medium"
            className="md:w-20 md:h-20"
            style={{ height: "100px", width: "100px" }}
          />
        </div>
        <p className="bg-gray-200 text-black mt-2 px-4 py-1 font-poppins rounded-full text-xs">
          {t("dashboard.recommendations.travelLikeLocal")}
        </p>
      </div>
    </div>
  );
};

export default QRSticker;
