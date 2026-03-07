import { useState, useRef } from "react";
import EditIcon from "../assets/icons/EditIcon";
import Cropper, { Area } from "react-easy-crop";
import getCroppedImg from "../utils/getCroppedImage";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { toast } from "sonner";
import { IMAGE_CONFIG } from "../config";
import { ACCEPT_STRINGS } from "../hooks/useFileUpload";
import axios from "axios";

interface ImageCropperProps {
  onFileUpload?: (file: File) => void;
  cropType: "profileCrop" | "backgroundCrop" | "guideCover";
  buttonTitle?: string;
  maxSizeMB?: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  onFileUpload,
  cropType,
  buttonTitle = "Edit Image",
  maxSizeMB = 10,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // New states for Instagram import
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [instagramInput, setInstagramInput] = useState("");
  const [isLoadingInstagram, setIsLoadingInstagram] = useState(false);

  const { aspectRatios } = IMAGE_CONFIG;

  // Show options menu instead of directly opening file picker
  const handleButtonClick = () => {
    // Only show Instagram option for profile pictures
    if (cropType === "profileCrop") {
      setShowOptionsMenu(true);
    } else {
      // For background/other crops, go directly to file picker
      fileInputRef.current?.click();
    }
  };

  const handleChooseFromDevice = () => {
    setShowOptionsMenu(false);
    fileInputRef.current?.click();
  };

  const handleImportFromInstagram = () => {
    setShowOptionsMenu(false);
    setShowInstagramModal(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Image size must be less than ${maxSizeMB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  };

  // Handle Instagram profile fetch
  const handleFetchInstagramProfile = async () => {
    if (!instagramInput.trim()) {
      toast.error("Please enter an Instagram username or profile link");
      return;
    }

    setIsLoadingInstagram(true);

    try {
      // Extract username from input (could be username or full URL)
      let username = instagramInput.trim();
      if (username.includes('instagram.com/')) {
        // Extract username from URL
        const urlMatch = username.match(/instagram\.com\/([^/?]+)/);
        if (urlMatch && urlMatch[1]) {
          username = urlMatch[1];
        }
      }

      // Get the authentication token
      const token = localStorage.getItem('qrtoken');
      if (!token) {
        toast.error("Please log in to use this feature");
        setIsLoadingInstagram(false);
        return;
      }

      // Call the Instagram API endpoint with POST and auth token
      const response = await axios.post(
        `${import.meta.env.VITE_INSTAGRAM_API_URL || 'http://localhost:5000'}/api/instagram/profile`,
        { username }, // Send username in request body
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success && response.data.data) {
        const profileData = response.data.data;

        // Check if account is public
        if (!profileData.isPublic) {
          toast.error("This Instagram account is private. Only public accounts are supported.");
          setIsLoadingInstagram(false);
          return;
        }

        // Fetch the profile picture
        const profilePictureUrl = profileData.profilePicture;

        if (!profilePictureUrl) {
          toast.error("Profile picture not found");
          setIsLoadingInstagram(false);
          return;
        }

        // Convert the image URL to a data URL
        const imageResponse = await fetch(profilePictureUrl);
        const blob = await imageResponse.blob();
        const reader = new FileReader();
        reader.onload = () => {
          setSelectedImage(reader.result as string);
          setShowInstagramModal(false);
          setInstagramInput("");
          setShowCropModal(true);
          setIsLoadingInstagram(false);
          toast.success(`Successfully imported profile picture for @${profileData.username}`);
        };
        reader.readAsDataURL(blob);
      } else {
        toast.error("Failed to fetch Instagram profile");
        setIsLoadingInstagram(false);
      }
    } catch (error: any) {
      console.error("Error fetching Instagram profile:", error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || "Failed to fetch Instagram profile. Please make sure the account is public.";
      toast.error(errorMessage);
      setIsLoadingInstagram(false);
    }
  };

  const handleCropComplete = async () => {
    try {
      if (!selectedImage || !croppedArea) return;

      const croppedImage = await getCroppedImg(selectedImage, croppedArea);

      setShowCropModal(false);
      setSelectedImage(null);
      setZoom(1);
      setCrop({ x: 0, y: 0 });

      if (croppedImage) {
        onFileUpload?.(croppedImage as File);
        toast.success("Image cropped successfully");
      }
    } catch (error) {
      toast.error("Error cropping the image");
      console.error("Error cropping image:", error);
    }
  };

  const handleCancel = () => {
    setShowCropModal(false);
    setSelectedImage(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const handleCancelInstagramModal = () => {
    setShowInstagramModal(false);
    setInstagramInput("");
  };

  const getAspectRatio = () => {
    switch (cropType) {
      case "profileCrop":
        return aspectRatios.profilePicture;
      case "backgroundCrop":
        return aspectRatios.backgroundPicture;
      case "guideCover":
        return aspectRatios.guideCover;
      default:
        return 1;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        className="bg-[hsl(var(--blue-cta))] p-2 rounded-full shadow-md hover:bg-[hsl(var(--blue-final))] transition-colors"
        title={buttonTitle}
        type="button"
        onClick={handleButtonClick}
      >
        <EditIcon color="white" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={ACCEPT_STRINGS.IMAGES_ONLY}
      />

      {/* Options Menu Modal - Only shown for profile pictures */}
      {cropType === "profileCrop" && (
        <Modal type="default" onClose={() => setShowOptionsMenu(false)} isOpen={showOptionsMenu}>
          <div className="p-6 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-[hsl(var(--text-primary))]">
              Choose Image Source
            </h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleChooseFromDevice}
                className="w-full px-6 py-4 bg-[hsl(var(--blue-cta))] text-white rounded-xl hover:bg-[hsl(var(--blue-final))] transition-all duration-200 font-medium text-lg shadow-md hover:shadow-lg"
              >
                📁 Choose from Device
              </button>
              <button
                onClick={handleImportFromInstagram}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 font-medium text-lg shadow-md hover:shadow-lg"
              >
                📸 Import Instagram Profile Photo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Instagram Username Modal */}
      <Modal type="default" onClose={handleCancelInstagramModal} isOpen={showInstagramModal}>
        <div className="p-6 w-full max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-[hsl(var(--text-primary))]">
            Import from Instagram
          </h2>
          <p className="text-sm text-[hsl(var(--text-secondary))] mb-6">
            Enter an Instagram username or profile link. Only public accounts are supported.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-[hsl(var(--text-primary))]">
              Username or Profile Link
            </label>
            <input
              type="text"
              value={instagramInput}
              onChange={(e) => setInstagramInput(e.target.value)}
              placeholder="username or https://instagram.com/username"
              className="w-full px-4 py-3 rounded-lg border border-[hsl(var(--border-primary))] bg-[hsl(var(--background-secondary))] text-[hsl(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-cta))]"
              disabled={isLoadingInstagram}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleFetchInstagramProfile();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              btnText="Cancel"
              variant="redText"
              size="small"
              onClickHandler={handleCancelInstagramModal}
              disabled={isLoadingInstagram}
            />
            <Button
              btnText={isLoadingInstagram ? "Loading..." : "Import"}
              variant="primary"
              size="small"
              onClickHandler={handleFetchInstagramProfile}
              isLoading={isLoadingInstagram}
              disabled={isLoadingInstagram || !instagramInput.trim()}
            />
          </div>
        </div>
      </Modal>

      {/* Crop Modal */}
      <Modal type="crop" onClose={handleCancel} isOpen={showCropModal}>
        <div className="p-1 w-full rounded-xl h-full">
          {selectedImage && (
            <div className="relative w-full h-96 rounded-xl bg-gray-100">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={getAspectRatio()}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) =>
                  setCroppedArea(croppedAreaPixels)
                }
              />
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              btnText="Cancel"
              variant="redText"
              size="small"
              onClickHandler={handleCancel}
            />
            <Button
              btnText="Confirm"
              variant="primary"
              size="small"
              onClickHandler={handleCropComplete}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ImageCropper;
