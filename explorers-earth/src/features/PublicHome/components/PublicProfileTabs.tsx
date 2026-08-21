import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export interface PublicProfileTabDefinition {
  id: "recommendations" | "gallery" | "business";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export interface PublicProfileTabsProps {
  tabs: PublicProfileTabDefinition[];
  activeTab: PublicProfileTabDefinition["id"];
  onChange: (tab: PublicProfileTabDefinition["id"]) => void;
}

export default function PublicProfileTabs({
  tabs,
  activeTab,
  onChange,
}: PublicProfileTabsProps) {
  const [focusedTabId, setFocusedTabId] = useState<PublicProfileTabDefinition["id"]>(activeTab);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setFocusedTabId(activeTab);
  }, [activeTab]);

  const scrollToTab = (tabId: PublicProfileTabDefinition["id"]) => {
    const el = tabRefs.current[tabId];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  };

  const handleSelectTab = (tabId: PublicProfileTabDefinition["id"]) => {
    setFocusedTabId(tabId);
    onChange(tabId);
    scrollToTab(tabId);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTabId: PublicProfileTabDefinition["id"],
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectTab(currentTabId);
      return;
    }

    const currentIndex = tabs.findIndex((t) => t.id === currentTabId);
    if (currentIndex === -1) return;

    const isRtl = typeof document !== "undefined" && document.dir === "rtl";
    let targetIndex: number | undefined;

    if (event.key === "ArrowRight") {
      targetIndex = isRtl
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex = isRtl
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== undefined) {
      event.preventDefault();
      const targetTab = tabs[targetIndex];
      setFocusedTabId(targetTab.id);
      onChange(targetTab.id);
      const targetEl = tabRefs.current[targetTab.id];
      if (targetEl) {
        targetEl.focus();
        scrollToTab(targetTab.id);
      }
    }
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Profile sections"
        className="flex w-full justify-center gap-8 border-b px-2 md:px-0 overflow-x-auto scrollbar-hide"
        style={{ borderColor: "var(--border-card)" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isFocused = focusedTabId === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              id={`public-profile-${tab.id}-tab`}
              role="tab"
              type="button"
              aria-controls={`public-profile-${tab.id}-panel`}
              aria-selected={isActive}
              tabIndex={isFocused ? 0 : -1}
              className="profile-presentation-focus min-h-12 min-w-12 py-2.5 text-xs font-poppins font-medium tracking-wide transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                borderColor: isActive ? "var(--accent-color)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              }}
              onClick={() => handleSelectTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              <Icon className="size-5" />
              <span className="sr-only">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
