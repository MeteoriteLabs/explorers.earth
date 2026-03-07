import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const { data: profile } = useProfile();
  const [location] = useLocation();

  if (!user) return null;

  // Determine if we're in the admin section
  const isAdminSection = location.startsWith('/admin');
  const headerTitle = isAdminSection ? "Admin Dashboard" : user.venueName;
  const headerLink = isAdminSection ? "/admin/dashboard" : "/dashboard";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40 w-full max-w-[100vw] overflow-x-hidden">
      <div className="w-full px-3 sm:px-4 mx-auto h-14 sm:h-16 flex items-center justify-between">
        <Link href={headerLink} className="flex-1 min-w-0">
          <span className="text-base sm:text-xl font-bold truncate block max-w-[60vw] sm:max-w-xs md:max-w-none" title={headerTitle}>
            {headerTitle}
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full flex-shrink-0">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                <AvatarImage 
                  src={profile?.profilePicture || '/default-avatar.png'} 
                  alt={user.username || 'User'} 
                />
                <AvatarFallback className="text-xs sm:text-sm">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[150px]">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings">
                <div className="flex items-center w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logoutMutation.mutate()} className="cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}