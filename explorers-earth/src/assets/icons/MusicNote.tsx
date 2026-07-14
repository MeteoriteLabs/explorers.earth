import { memo } from "react";

const MusicNote = memo(({ size, fill, outline, strokeColor }: { size?: string; fill?: string; outline?: boolean; strokeColor?: string }) => {
  return (
    <svg
      width={size || "24"}
      height={size || "24"}
      viewBox="0 0 512 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M470.38 1.51L171.06 77.57C170.88 77.61 170.71 77.65 170.53 77.7C170.36 77.74 170.19 77.79 170.02 77.84L169.88 77.88V329.13C155.82 320.28 138.84 315.09 120.75 315.09C54.13 315.09 0 369.22 0 435.84C0 502.46 54.13 556.59 120.75 556.59C187.37 556.59 241.5 502.46 241.5 435.84V200.09L464 140.08V258.88C449.94 250.03 432.96 244.84 414.87 244.84C348.25 244.84 294.12 298.97 294.12 365.59C294.12 432.21 348.25 486.34 414.87 486.34C481.49 486.34 535.62 432.21 535.62 365.59V0L470.38 1.51Z"
        fill={outline ? "none" : (fill || "currentColor")}
        stroke={outline ? (strokeColor || "white") : "none"}
        strokeWidth={outline ? 1.5 : 0}
        vectorEffect={outline ? "non-scaling-stroke" : undefined}
      />
    </svg>
  );
});

MusicNote.displayName = "MusicNote";

export default MusicNote;
