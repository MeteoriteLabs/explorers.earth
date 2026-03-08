import { FC, memo, useEffect, useState } from "react";
import LeftIcon from "../../assets/icons/LeftIcon";
import RightIcon from "../../assets/icons/RightIcon";
import { useCityStore } from "../../store/useCityStore";
import Button from "./Button";
import VerticalKebab from "../../assets/icons/VerticalKebab";
import CrossIcon from "../../assets/icons/CrossIcon";
import ImageWithFallback from "./ImageWithFallback";

type items = {
  List_Name?: string;
  imageUrl: string;
  documentId?: string;
};

type MenuItem = {
  label?: string;
  component?: JSX.Element;
  onClickHandler?: () => void;
};

interface CarouselProps {
  items: items[];
  type?: "public" | "default";
  menuItems?: MenuItem[];
  onClickHandler: (items: items) => void;
}
const Carousel: FC<CarouselProps> = memo(
  ({ items, onClickHandler, menuItems, type }) => {
    const { selectedCity } = useCityStore();
    const [showMenu, setShowMenu] = useState<boolean>(false);

    useEffect(() => {
      if (selectedCity?.documentId) {
        const index = items.findIndex(
          (item) => item.documentId === selectedCity.documentId
        );
        if (index !== -1) {
          setCurrentIndex(index);
        }
      }
    }, [selectedCity, items]);
    // local state for handling the active carousel
    const [currentIndex, setCurrentIndex] = useState(0);

    // updating state for hadnling the next index
    // also updating the active index
    const handleNext = (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const nextIndex = (currentIndex + 1) % items.length;
      setCurrentIndex(nextIndex);
      onClickHandler(items[nextIndex]);
    };

    // updating state for hadnling the next index
    // also updating the active index
    const handlePrev = (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const prevIndex =
        currentIndex === 0 ? items.length - 1 : currentIndex - 1;
      setCurrentIndex(prevIndex);
      onClickHandler(items[prevIndex]);
    };

    return (
      <div className="relative md:w-full md:max-w-md w-[75%]   mx-auto">
        {type !== "public" && (
          <div className="absolute right-0">
            <Button
              startIcon={
                showMenu ? <CrossIcon stroke="white"/> : <VerticalKebab size={"6"} />
              }
              variant="ghost"
              onClickHandler={() => setShowMenu((prev) => !prev)}
            />
          </div>
        )}
        {showMenu && (
          <div className="absolute h-full  z-40 pr-0.5  right-0 top-8">
            {menuItems?.map((menuItem, index) =>
              menuItem.component ? (
                <div key={menuItem.label || index} className="h-full">
                  {menuItem.component}
                </div>
              ) : (
                <button
                  key={index || menuItem.label}
                  onClick={() => menuItem.onClickHandler}
                  className="flex items-center cursor-pointer font-poppins text-sm  transition-colors justify-between p-2 text-gray-800"
                >
                  {menuItem.label}
                </button>
              )
            )}
          </div>
        )}

        {type === "public" && (
          <div className="absolute h-full  z-40 p-2 right-0 top-0">
            {menuItems?.map((menuItem, index) =>
              menuItem.component ? (
                <div key={menuItem.label || index} className="h-full">
                  {menuItem.component}
                </div>
              ) : (
                <button
                  key={index || menuItem.label}
                  onClick={() => menuItem.onClickHandler}
                  className="flex items-center cursor-pointer font-poppins text-sm  transition-colors justify-between p-2 text-gray-800"
                >
                  {menuItem.label}
                </button>
              )
            )}
          </div>
        )}

        <div
          className={`md:h-44 ${
            type === "public" ? "h-28" : "h-20"
          } border-2 border-white cursor-pointer  rounded-xl flex items-center justify-center text-center`}
        >
          {items[currentIndex]?.imageUrl ? (
            <ImageWithFallback
              src={items[currentIndex].imageUrl}
              alt={items[currentIndex].List_Name || "Image"}
              className="h-full w-full object-cover"
            />
          ) : (
            <p className="text-white font-semibold text-2xl font-poppins">
              {items[currentIndex]?.List_Name}
            </p>
          )}
        </div>
        <div className="absolute w-full  flex justify-between font-poppins items-center top-1/2 transform -translate-y-1/2">
          <button onClick={handlePrev} className="-ml-12">
            <LeftIcon />
          </button>
          <button onClick={handleNext} className="-mr-12">
            <RightIcon />
          </button>
        </div>
      </div>
    );
  }
);

export default Carousel;
