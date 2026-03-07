import { FC, memo } from "react";

interface PhotosProps {
  Media?: {
    url: string;
  }[];
}

const Photos: FC<PhotosProps> = memo(({ Media }) => {
  // Early return if Media is not provided or empty
  if (!Media || !Array.isArray(Media) || Media.length === 0) {
    return (
      <div className="mt-4 flex justify-center mb-20 gap-6 items-center">
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex justify-center mb-20 gap-6 items-center">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Media.map((image: { url: string }, index: number) => (
          <div key={index} className="relative">
            <img
              src={image.url}
              alt="Preview"
              className="object-cover cursor-pointer h-40 w-40 rounded-xl"
            />
          </div>
        ))}
      </div>
    </div>
  );
});

export default Photos;
