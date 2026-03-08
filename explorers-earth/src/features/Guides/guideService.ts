import axios from "axios";
import { generateGuideUploadPath, generateRandomFileName } from "../../utils/uploadPathGenerator";

const API_URL = import.meta.env.VITE_REST_API_URL || "/api";

export const deleteGuideMedia = async (fileId: string | number): Promise<void> => {
  if (!fileId) {
    console.warn("Invalid media ID for deletion:", fileId);
    return;
  }
  
  const token = localStorage.getItem("qrtoken");
  
  try {
    await axios.delete(`${API_URL}/upload/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error: any) {
    console.error(`Failed to delete media ${fileId}:`, error.response?.data || error.message);
    throw error;
  }
};

export const uploadGuideMedia = async (
  guideId: string,
  guideDocumentId: string,
  file: File,
  username: string,
  existingMediaIds?: (string | number)[]
): Promise<any> => {
  const token = localStorage.getItem("qrtoken");
  
  // Delete existing media files first
  if (existingMediaIds && existingMediaIds.length > 0) {
    for (const mediaId of existingMediaIds) {
      try {
        await deleteGuideMedia(mediaId);
      } catch (error) {
        console.warn(`Failed to delete media ${mediaId}`);
      }
    }
  }
  
  const formData = new FormData();
  
  // Generate structured path using shared utility
  const filename = generateRandomFileName(file.name);
  const structuredPath = generateGuideUploadPath(username, guideDocumentId, filename);
  
  // Append file and metadata
  formData.append("files", file);
  formData.append("refId", guideId);
  formData.append("ref", "api::guide.guide");
  formData.append("field", "Guide_Media");
  formData.append("path", structuredPath);
  
  // Upload to Strapi
  const response = await axios.post(`${API_URL}/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      Authorization: `Bearer ${token}`,
    },
  });
  
  return response.data;
};

export const getGuideById = async (documentId: string): Promise<any> => {
  const token = localStorage.getItem("qrtoken");
  
  const response = await axios.get(`${API_URL}/guides`, {
    params: {
      filters: {
        documentId: {
          $eq: documentId,
        },
      },
      populate: {
        Guide_Media: true,
      },
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  return response.data?.data?.[0] || null;
};

const guideService = {
  uploadGuideMedia,
  getGuideById,
  deleteGuideMedia,
};

export default guideService;
