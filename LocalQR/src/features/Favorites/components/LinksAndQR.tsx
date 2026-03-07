import { FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import DownloadIcon from "../../../assets/icons/DownloadIcon";
import WhatsappIcon from "../../../assets/icons/WhatsappIcon";
import InstagramIcon from "../../../assets/icons/InstagramIcon";
import MobileIcon from "../../../assets/icons/MobileIcon";
import useAuthStore from "../../../store/store";
import { getCurrentDomain } from "../../../utils/getCurrentDomain";
import BoldLinkIcon from "../../../assets/icons/BoldLinkIcon";
import { useCityStore } from "../../../store/useCityStore";
import DeleteIcon from "../../../assets/icons/DeleteIcon";
import EditIcon from "../../../assets/icons/EditIcon";
import EyeOffIcon from "../../../assets/icons/EyeOffIcon";
import EyeOnIcon from "../../../assets/icons/EyeOnIcon";
import Button from "../../../components/ui/Button";
import { useMenuItems } from "../hooks/useMenuItems";
import { OperationVariables, ApolloQueryResult } from "@apollo/client";
import Accordion from "../../../components/ui/Accordian";
import QRSticker from "./QRSticker";
import TwitterIcon from "../../../assets/icons/TwitterIcon";
import ShareModal from "../../../components/ShareModal";
import ShareIcon from "../../../assets/icons/ShareIcon";
import ThemedIcon from "../../../components/ui/ThemedIcon";
import { useQRActions } from "../../../hooks/useQRActions";
import { generateRecommendationQRUrl } from "../../../utils/qrCodeService";
import { createUtmParams } from "../../../utils/urlHelpers";

// type interface for Recommendations
interface Recommendation {
  title: string;
  image: string;
  rating: number;
  reviews: number;
}

// type interface for Selected city (Recommendation List)
export interface SelectedCity {
  documentId?: string;
  List_name?: string;
  slug?: string;
  Visibility?: boolean;
  recommendations?: Recommendation[] | undefined;
}

interface LinksAndQRProps {
  refetchCities: (
    variables?: Partial<OperationVariables>
  ) => Promise<ApolloQueryResult<unknown>>;
  setShowConfirmDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLocationModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleConfirmDeleteModal: () => void;
}
const LinksAndQR: FC<LinksAndQRProps> = memo(
  ({
    refetchCities,
    setShowConfirmDeleteModal,
    setIsEditing,
    handleConfirmDeleteModal,
    setIsLocationModalOpen,
  }) => {
    const { t } = useTranslation();
    const [showShareModal, setShowShareModal] = useState<boolean>(false);
    const { selectedCity } = useCityStore();
    // user object from the state
    const { user } = useAuthStore();

    // Create UTM parameters for QR code sharing
    const qrUtmParams = createUtmParams.qrCode();

    // Use centralized QR actions hook with recommendation context
    // LinksAndQR is used in Favorites page for specific recommendation lists
    // QR should redirect to: host/{username}/places/{recommendationListName}
    const { qrRef, handleDownloadQR, handleCopyLink } = useQRActions({
      username: user?.username,
      context: "recommendation",
      recommendationListName: selectedCity?.slug, // This should be the recommendation list name
      utmParams: qrUtmParams, // Include UTM parameters for tracking
    });

    // custom hook for handling the carousel menu logic
    const { handleRecommendationListVisibility, isPublished } = useMenuItems({
      refetchCities,
      setShowConfirmDeleteModal,
    });

    const handleEditRecommendedList = () => {
      setIsEditing(true);
      setIsLocationModalOpen(true);
    };
    const shareButtons = [
      {
        name: "Instagram",
        icon: <InstagramIcon color="white" />,
        url: `https://www.instagram.com/`,
      },
      {
        name: "Twitter",
        icon: <TwitterIcon color="white" />,
        url: `https://twitter.com/`,
      },
      {
        name: "WhatsApp",
        icon: <WhatsappIcon fill="white" />,
        url: `https://www.whatsapp.com/`,
      },
      {
        name: "Mobile",
        icon: (
          <ThemedIcon variant="primary">
            <MobileIcon />
          </ThemedIcon>
        ),
        url: `www.gmail.com`,
      },
    ];

    const url = getCurrentDomain();

    // Generate QR URL for recommendation: host/{username}/places/{recommendationListName}
    const qrCodeUrl =
      user?.username && selectedCity?.slug
        ? generateRecommendationQRUrl(user.username, selectedCity.slug, qrUtmParams)
        : `${url}/${user?.username}`;

    return (
      <div className="mb-0 md:mt-6 md:w-3/4 md:mx-auto">
        <div className="bg-transparent rounded-lg p-6 space-y-4 border border-white">
          {/* Manage Accordion */}
          <Accordion
            heading={t("dashboard.recommendations.manageHeading")}
            defaultOpen={true}
          >
            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirmDeleteModal}
                className="flex flex-row text-center gap-2 items-center rounded-md focus:outline-none transition-all duration-300 font-poppins w-full text-sm border border-white px-4 py-3 hover:border-gray-500 text-white hover:text-gray-500 justify-center font-medium"
              >
                <DeleteIcon />{" "}
                <span className="font-poppins">
                  {t("dashboard.recommendations.deleteAction")}
                </span>
              </button>
              <button
                onClick={handleEditRecommendedList}
                className="flex flex-row text-center gap-2 items-center rounded-md focus:outline-none transition-all duration-300 font-poppins w-full text-sm border border-white px-4 py-3 hover:border-gray-500 text-white hover:text-gray-500 justify-center font-medium"
              >
                <EditIcon color="var(--dash-text)" />
                <span className="font-poppins">
                  {t("dashboard.recommendations.editAction")}
                </span>
              </button>
              <button
                onClick={handleRecommendationListVisibility}
                className={`flex flex-row gap-2 items-center rounded-md focus:outline-none transition-all duration-300 font-poppins w-full text-sm border ${
                  isPublished
                    ? "border-[hsl(var(--status-published))] text-[hsl(var(--status-published))]"
                    : "border-dashboard-danger text-dashboard-danger"
                } justify-center font-medium px-4 py-3`}
              >
                {isPublished ? (
                  <EyeOnIcon stroke="hsl(var(--status-published))" size="5" />
                ) : (
                  <EyeOffIcon stroke="var(--dash-danger)" size="5" />
                )}
                <span className="font-poppins">
                  {isPublished
                    ? t("dashboard.recommendations.publishedStatus")
                    : t("dashboard.recommendations.draftStatus")}
                </span>
              </button>
            </div>
          </Accordion>

          {/* QR Accordion */}
          <Accordion
            heading={t("dashboard.recommendations.myQRHeading")}
            defaultOpen={true}
          >
            <div className={`relative ${!isPublished && "blur"}`}>
              <div className="flex justify-center items-center my-4">
                <QRSticker
                  qrRef={qrRef}
                  qrCodeUrl={qrCodeUrl}
                />
              </div>

              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-row gap-5 items-center h-full">
                  <div className="flex flex-col justify-center items-center" data-walkthrough="share-button">
                    <Button
                      startIcon={<ShareIcon color="white" />}
                      variant="ghost"
                      onClickHandler={() => setShowShareModal(true)}
                    />
                    <span className="font-poppins text-white text-xs">
                      {t("dashboard.recommendations.shareLink")}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      startIcon={<BoldLinkIcon color="white" />}
                      variant="ghost"
                      onClickHandler={handleCopyLink}
                    />
                    <span className="font-poppins text-white text-xs">
                      {t("dashboard.recommendations.copyLink")}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      startIcon={<DownloadIcon />}
                      variant="ghost"
                      onClickHandler={handleDownloadQR}
                    />
                    <span className="font-poppins text-white text-xs">
                      {t("dashboard.recommendations.downloadQR")}
                    </span>
                  </div>
                </div>

              <ShareModal
                shareButtons={shareButtons}
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                url={qrCodeUrl}
                utmParams={qrUtmParams}
                backgroundImage={selectedCity?.List_Name_Details?.thumbnail}
              />
              </div>
            </div>
          </Accordion>
        </div>
      </div>
    );
  }
);

export default LinksAndQR;
