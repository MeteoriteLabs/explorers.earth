import { FC, MouseEventHandler, ReactElement } from "react";

interface NavButtonProps {
  icon: ReactElement;
  text: string;
  onClickHandler: MouseEventHandler<HTMLButtonElement>;
  isActive: boolean;
  type?: "default" | "public";
}

const NavButton: FC<NavButtonProps> = ({
  icon,
  onClickHandler,
  isActive,
}) => {
  return (
    <button
      onClick={onClickHandler}
      className={`
        flex-1 flex font-poppins text-xs flex-col gap-1.5 items-center justify-center
        py-2.5 px-2 rounded-xl transition-all duration-300 ease-in-out
        hover:scale-105 active:scale-95
        ${
          isActive 
            ? "bg-white shadow-md" 
            : "hover:bg-dashboard-muted/50"
        }
      `}
    >
      <div className="transition-transform duration-300">
        {icon}
      </div>
    </button>
  );
};

export default NavButton;
