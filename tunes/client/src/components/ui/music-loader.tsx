import { Music, Music2, Music3, Music4 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MusicLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

export function MusicLoader({ size = "default", className, ...props }: MusicLoaderProps) {
  const icons = [Music, Music2, Music3, Music4];
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <div 
      className={cn("flex items-center justify-center gap-2", className)} 
      {...props}
    >
      {icons.map((Icon, index) => (
        <Icon
          key={index}
          className={cn(
            sizeClasses[size],
            "text-primary animate-bounce",
            {
              "animation-delay-0": index === 0,
              "animation-delay-100": index === 1,
              "animation-delay-200": index === 2,
              "animation-delay-300": index === 3,
            }
          )}
          style={{
            animationDuration: "1s",
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  );
}
