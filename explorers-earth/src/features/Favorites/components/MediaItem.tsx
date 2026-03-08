import { FC, memo, ReactNode } from "react";

interface MediaItemProps {
  value: string;
  icon: ReactNode;
}
const MediaItem: FC<MediaItemProps> = memo(({ value, icon }) => {
  return (
    <div
      className="flex font-poppins items-center gap-3 bg-gray-700 p-4 rounded-md shadow-md"
      
    >
      {icon}
      <span className="text-white">{value}</span>
    </div>
  );
});
export default MediaItem;
