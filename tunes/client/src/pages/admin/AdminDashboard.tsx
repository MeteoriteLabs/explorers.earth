import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BarChart3, BookOpen, Code, Globe2, Lock, Mail, Menu, Settings, Shield, Users } from "lucide-react";
import AnalyticsTab from "./tabs/AnalyticsTab";
import UsersTab from "./tabs/UsersTab";
import TeamTab from "./tabs/TeamTab";
import SystemTab from "./tabs/SystemTab";
import ApiTokensTab from "./tabs/ApiTokensTab";
import EmailTab from "./tabs/EmailTab";
import SeoTab from "./tabs/SeoTab";
import WebsiteTab from "./tabs/WebsiteTab";
import GuestApisTab from "./tabs/GuestApisTab";
import EmailApisTab from "./tabs/EmailApisTab";

type TabId =
  | "analytics"
  | "users"
  | "team"
  | "website"
  | "seo"
  | "system"
  | "email"
  | "apitokens"
  | "guestapis"
  | "emailapis";

type SidebarItem = {
  id: TabId;
  label: string;
  icon: JSX.Element;
};

const mainSidebarItems: SidebarItem[] = [
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { id: "team", label: "Team", icon: <Shield className="h-4 w-4" /> },
  { id: "website", label: "Website", icon: <Globe2 className="h-4 w-4" /> },
  { id: "seo", label: "SEO", icon: <Globe2 className="h-4 w-4" /> },
  { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
];

const apiSidebarItems: SidebarItem[] = [
  { id: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { id: "apitokens", label: "API Tokens", icon: <Lock className="h-4 w-4" /> },
  { id: "guestapis", label: "Guest APIs", icon: <Code className="h-4 w-4" /> },
  { id: "emailapis", label: "Email APIs", icon: <BookOpen className="h-4 w-4" /> },
];

const allItems = [...mainSidebarItems, ...apiSidebarItems];
const validTabIds = new Set<TabId>(allItems.map((item) => item.id));

function getTabFromLocation(location: string): TabId {
  const queryParams = new URLSearchParams(location.split("?")[1] || "");
  const tab = queryParams.get("tab");
  if (tab && validTabIds.has(tab as TabId)) {
    return tab as TabId;
  }
  return "analytics";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabId>(() => getTabFromLocation(location));

  useEffect(() => {
    setSelectedTab(getTabFromLocation(location));
  }, [location]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === selectedTab) ?? allItems[0],
    [selectedTab]
  );

  const renderContent = () => {
    switch (selectedTab) {
      case "analytics":
        return <AnalyticsTab />;
      case "users":
        return <UsersTab />;
      case "team":
        return <TeamTab />;
      case "website":
        return <WebsiteTab />;
      case "seo":
        return <SeoTab />;
      case "system":
        return <SystemTab />;
      case "email":
        return <EmailTab />;
      case "apitokens":
        return <ApiTokensTab />;
      case "guestapis":
        return <GuestApisTab />;
      case "emailapis":
        return <EmailApisTab />;
      default:
        return <AnalyticsTab />;
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <div
        className={cn(
          "bg-card border-r flex flex-col transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b">
          <h2 className={cn("font-semibold truncate", sidebarCollapsed && "hidden")}>Admin Dashboard</h2>
        </div>

        <div className="p-2 border-b">
          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="w-full p-2 hover:bg-accent rounded-md flex items-center justify-center"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-4 w-4 mr-2" />
            {!sidebarCollapsed && <span className="text-sm">Toggle Sidebar</span>}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {mainSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTab(item.id)}
              className={cn(
                "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors",
                selectedTab === item.id ? "bg-primary/10 text-primary" : "hover:bg-accent",
                sidebarCollapsed && "justify-center"
              )}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          {!sidebarCollapsed && (
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="apis" className="border-none">
                <AccordionTrigger className="px-3 py-2 hover:bg-accent rounded-md text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <Code className="h-4 w-4" />
                    <span>APIs</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0">
                  {apiSidebarItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedTab(item.id)}
                      className={cn(
                        "w-full flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ml-2",
                        selectedTab === item.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {sidebarCollapsed &&
            apiSidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-center px-3 py-2 rounded-md transition-colors",
                  selectedTab === item.id ? "bg-primary/10 text-primary" : "hover:bg-accent"
                )}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{selectedItem.label}</h1>
              <p className="text-muted-foreground">Manage and monitor your platform</p>
            </div>
          </div>
          <div className="pb-6">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
