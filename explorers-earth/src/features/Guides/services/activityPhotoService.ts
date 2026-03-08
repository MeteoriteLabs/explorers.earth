/**
 * Activity Photo Upload Service
 * Handles downloading Google Photos and uploading to Strapi S3
 */

import axios from "axios";
import { 
  generateRandomFileName,
  generateActivityPhotoPath 
} from "../../../utils/uploadPathGenerator";
import { FetchedPhoto } from "../utils/googlePhotosService";
import type { UploadedActivityPhoto } from "../types/guideSectionTypes";

const API_URL = import.meta.env.VITE_REST_API_URL || "/api";

/**
 * Upload a single Google photo to Strapi S3 (internal helper)
 * @param photoUrl - Google Photo URL
 * @param username - User's username for path generation
 * @param sectionId - Guide section document ID
 * @param placeId - Google Place ID
 * @param photoIndex - Index of the photo
 * @param photoMetadata - Photo metadata (width, height, aspectRatio)
 * @returns Uploaded photo data
 */
const uploadActivityPhoto = async (
  photoUrl: string,
  username: string,
  sectionId: string,
  placeId: string,
  photoIndex: number,
  photoMetadata: Pick<FetchedPhoto, 'width' | 'height' | 'aspectRatio'>
): Promise<UploadedActivityPhoto | null> => {
  const token = localStorage.getItem("qrtoken");

  try {
    // Fetch the photo from Google
    const photoResponse = await axios.get(photoUrl, {
      responseType: 'blob',
    });

    if (!photoResponse.data) {
      throw new Error("Failed to fetch photo from Google");
    }

    const photoBlob = photoResponse.data;

    // Generate structured path
    const fileName = generateRandomFileName(`activity-${photoIndex}.jpg`);
    const structuredPath = generateActivityPhotoPath(
      username,
      sectionId,
      placeId,
      fileName
    );

    // Upload to Strapi S3
    const formData = new FormData();
    formData.append(
      "files",
      new File([photoBlob], fileName, { type: "image/jpeg" })
    );
    formData.append("path", structuredPath);

    const uploadResponse = await axios.post(
      `${API_URL}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    const uploadedFile = uploadResponse.data?.[0];
    
    if (!uploadedFile?.url) {
      throw new Error("Upload response missing URL");
    }

    return {
      id: `activity-photo-${uploadedFile.id}`,
      documentId: uploadedFile.documentId,
      url: uploadedFile.url,
      fileName,
      width: photoMetadata.width,
      height: photoMetadata.height,
      aspectRatio: photoMetadata.aspectRatio,
    };
  } catch (error: any) {
    console.error("Error uploading activity photo:", error.response?.data || error.message);
    return null;
  }
};

/**
 * Upload multiple activity photos in parallel
 * @param photos - Array of Google photos to upload
 * @param username - User's username
 * @param sectionId - Guide section document ID
 * @param placeId - Google Place ID
 * @returns Array of uploaded photo data
 */
export const uploadActivityPhotos = async (
  photos: FetchedPhoto[],
  username: string,
  sectionId: string,
  placeId: string
): Promise<UploadedActivityPhoto[]> => {
  if (!photos || photos.length === 0) {
    return [];
  }

  // Upload photos in parallel with limit of 4 concurrent uploads
  const uploadPromises = photos.map((photo, index) =>
    uploadActivityPhoto(
      photo.url,
      username,
      sectionId,
      placeId,
      index,
      {
        width: photo.width,
        height: photo.height,
        aspectRatio: photo.aspectRatio,
      }
    )
  );

  const uploadedPhotos = await Promise.all(uploadPromises);
  
  // Filter out failed uploads
  return uploadedPhotos.filter(
    (photo): photo is UploadedActivityPhoto => photo !== null
  );
};
