
/**
 * Resizes and crops an image to a specific aspect ratio (default 16:9).
 * Returns a new File object.
 */
export const resizeImageToAspectRatio = (
    file: File,
    aspectRatio: number = 16 / 9
): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            // Calculate source dimensions
            const sourceWidth = img.naturalWidth;
            const sourceHeight = img.naturalHeight;
            const sourceAspectRatio = sourceWidth / sourceHeight;

            let drawWidth = sourceWidth;
            let drawHeight = sourceHeight;
            let offsetX = 0;
            let offsetY = 0;

            // Calculate crop dimensions to center the image
            if (sourceAspectRatio > aspectRatio) {
                // Image is wider than target
                drawWidth = sourceHeight * aspectRatio;
                offsetX = (sourceWidth - drawWidth) / 2;
            } else {
                // Image is taller than target
                drawHeight = sourceWidth / aspectRatio;
                offsetY = (sourceHeight - drawHeight) / 2;
            }

            // Set canvas to target dimensions (or scaled down if needed?)
            // For now, keep full resolution of the crop
            canvas.width = drawWidth;
            canvas.height = drawHeight;

            // Draw the cropped image
            ctx.drawImage(
                img,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight,
                0,
                0,
                drawWidth,
                drawHeight
            );

            // Convert to file
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Keep original name but ensure unique if needed (handled by caller)
                        const resizedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now(),
                        });
                        resolve(resizedFile);
                    } else {
                        reject(new Error("Canvas to Blob failed"));
                    }
                },
                file.type,
                0.9 // Quality
            );
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
};
