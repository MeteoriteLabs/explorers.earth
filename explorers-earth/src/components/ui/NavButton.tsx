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
  text,
  onClickHandler,
  isActive,
}) => {
  return (
    <button
      onClick={onClickHandler}
      className={`
        relative flex-1 flex font-poppins flex-col items-center justify-center gap-1
        pt-3 pb-2 px-1 rounded-xl transition-all duration-300 ease-in-out
        hover:scale-105 active:scale-95
        ${isActive ? "" : "hover:bg-dashboard-muted/50"}
      `}
    >


      <div className="transition-transform duration-300">
        {icon}
      </div>

      {/* Tab label */}
      <span
        className={`
          text-[10px] leading-tight font-medium tracking-wide truncate max-w-full transition-all duration-300
          ${isActive ? "text-white" : "text-white/50"}
        `}
      >
        {text}
      </span>
    </button>
  );
};

export default NavButton;
