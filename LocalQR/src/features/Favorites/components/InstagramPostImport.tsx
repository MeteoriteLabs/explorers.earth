import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";

interface InstagramPostImportProps {
    isOpen: boolean;
    onClose: () => void;
    listId?: string;
}

interface InstagramPostData {
    username: string;
    caption: string;
    location: string;
    media: Array<{
        type: string;
        url: string;
    }>;
    postUrl: string;
    thumbnailUrl: string;
}

const InstagramPostImport = ({ isOpen, onClose, listId }: InstagramPostImportProps) => {
    const navigate = useNavigate();
    const [postUrl, setPostUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleExtractAndRedirect = async () => {
        if (!postUrl.trim()) {
            toast.error("Please enter an Instagram post URL");
            return;
        }

        // Get the authentication token
        const token = localStorage.getItem('qrtoken');
        if (!token) {
            toast.error("Please log in to use this feature");
            return;
        }

        setIsLoading(true);

        try {
            // Call the Instagram extraction endpoint
            const response = await axios.post(
                `${import.meta.env.VITE_INSTAGRAM_API_URL || 'http://localhost:5000'}/api/instagram/extract`,
                { postUrl },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success && response.data.data) {
                const data: InstagramPostData = response.data.data;

                // Check if location is available
                if (!data.location || data.location === 'Unknown') {
                    toast.error("No location found in this post. Please choose a post with location tagged.");
                    setIsLoading(false);
                    return;
                }

                // Store the extracted data in sessionStorage for the recommendation form
                sessionStorage.setItem('instagram_post_data', JSON.stringify(data));

                // Navigate to the recommendation form with a flag
                if (listId) {
                    navigate(`/${listId}/new?fromInstagram=true`);
                } else {
                    navigate('/recommendations/new?fromInstagram=true');
                }

                toast.success("Instagram post data extracted successfully!");
                onClose();
            } else {
                toast.error("Failed to extract Instagram post data");
            }
        } catch (error: any) {
            console.error("Error extracting Instagram post:", error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || "Failed to extract Instagram post data";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal type="default" onClose={onClose} isOpen={isOpen}>
            <div className="p-6 w-full max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-[hsl(var(--text-primary))]">
                    Import from Instagram Post
                </h2>
                <p className="text-sm text-[hsl(var(--text-secondary))] mb-6">
                    Enter an Instagram post or reel URL to automatically create a recommendation with the location and media from the post.
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-2 text-[hsl(var(--text-primary))]">
                        Instagram Post URL
                    </label>
                    <input
                        type="text"
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/..."
                        className="w-full px-4 py-3 rounded-lg border border-[hsl(var(--border-primary))] bg-[hsl(var(--background-secondary))] text-[hsl(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-cta))]"
                        disabled={isLoading}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleExtractAndRedirect();
                            }
                        }}
                    />
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-2">
                        💡 Make sure the post has a location tagged
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <Button
                        btnText="Cancel"
                        variant="redText"
                        size="small"
                        onClickHandler={onClose}
                        disabled={isLoading}
                    />
                    <Button
                        btnText={isLoading ? "Extracting..." : "Import"}
                        variant="primary"
                        size="small"
                        onClickHandler={handleExtractAndRedirect}
                        isLoading={isLoading}
                        disabled={isLoading || !postUrl.trim()}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default InstagramPostImport;
