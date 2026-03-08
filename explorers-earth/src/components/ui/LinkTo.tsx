import { FC } from "react";

interface LinkToProps {
  to?: string;
  onClickHandler?: () => void;
  icon: React.ReactNode;
  text: string;
}

const LinkTo: FC<LinkToProps> = ({ to, icon, text, onClickHandler }) => {
  return (
    <a
      href={to}
      target="_blank"
      className="flex cursor-pointer flex-col items-center gap-1"
      onClick={onClickHandler}
    >
      {icon}
      <span className="text-white font-poppins text-xs font-medium">
        {text}
      </span>
    </a>
  );
};

export default LinkTo;
