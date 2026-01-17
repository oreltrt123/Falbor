'use client';

import Link from 'next/link';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useClerk } from "@clerk/nextjs";
import { Settings } from 'lucide-react';
import { israelTimeToUTC, utcToIsraelTime } from "@/lib/common/timezone/timezone-utils";
import { AutomationDialog } from "@/components/models/AutomationDialog";
import { Badge } from "@/components/ui/badge";
import { useRouter } from 'next/navigation';

interface MenuItem {
  type: 'item';
  label: React.ReactNode;
  action?: string;
  shortcut?: string;
  hasSubmenu?: boolean;
  icon?: React.ReactNode;
}

interface MenuSeparator {
  type: 'separator';
}

type MenuItemOption = MenuItem | MenuSeparator;

interface MenuConfig {
  label: string;
  items: MenuItemOption[];
}

interface MacOSMenuBarProps {
  appName?: string;
  menus?: MenuConfig[];
  onMenuAction?: (action: string) => void;
  className?: string;
}

interface CreditsData {
  credits: number
  secondsUntilNextRegen: number
  pendingGift?: number
  pendingMonthly?: number
  subscriptionTier: string
}

interface AutomationSettings {
  selectedModel: string
  dailyTime: string // "HH:MM:SS" UTC stored internally
  maxMessages: number
  isActive: boolean
  timezone: string
}

interface ModelOption {
  label: string
  icon: string
  color: string
  soon?: string
}

export type ModelType = "gemini" | "claude" | "gpt" | "deepseek" | "gptoss"

const DEFAULT_MENUS: MenuConfig[] = [
  // {
  //   label: 'Help',
  //   items: [
  //     { type: 'item', label: 'Search', action: 'search-help' },
  //     { type: 'separator' },
  //     { type: 'item', label: 'Help Docs', action: 'app-help' },
  //     { type: 'item', label: 'Contact Support', action: 'contact-support' },
  //   ],
  // },
];

const APPLE_MENU_ITEMS: MenuItemOption[] = [
  { type: 'item', label: 'Return to home', action: '/' },
  { type: 'item', label: 'About This Website', action: '/about' },
  { type: 'separator' },
  { type: 'item', label: 'Restart...', action: 'restart' }, // ← this one will now reload the page
  { type: 'item', label: 'Log Out...', action: 'logout', shortcut: '⇧⌘Q' },
];

interface MenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  items: MenuItemOption[];
  left: number;        // New: horizontal position
  onAction?: (action: string) => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  isOpen,
  onClose,
  items,
  left,
  onAction
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute backdrop-blur-md z-[9999]"
      style={{
        left: `${left}px`,
        top: '34px',
        background: 'rgba(40, 40, 40, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '8px',
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.4),
          0 2px 8px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.12)
        `,
        minWidth: '220px',
        animation: 'menuFadeIn 0.15s cubic-bezier(0.23, 1, 0.32, 1) forwards'
      }}
    >
      <div className="py-1">
        {items.map((item, index) => {
          if (item.type === 'separator') {
            return (
              <div
                key={index}
                className="h-px bg-white/15 mx-2 my-1"
              />
            );
          }

          return (
            <div
              key={index}
              className="px-4 py-1 text-white text-sm cursor-pointer hover:bg-white/10 transition-colors duration-100 flex justify-between items-center"
              onClick={() => {
                if (item.action) {
                  onAction?.(item.action);
                }
                onClose();
              }}
            >
              <span className="flex items-center">
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
                {item.hasSubmenu && (
                  <span className="ml-2 text-xs opacity-70">▶</span>
                )}
              </span>
              {item.shortcut && (
                <span className="text-xs text-white/60 ml-4">
                  {item.shortcut}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes menuFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const MacOSMenuBar: React.FC<MacOSMenuBarProps> = ({
  appName = 'Pricing',
  menus = DEFAULT_MENUS,
  onMenuAction,
  className = ''
}) => {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Fetch automation settings
  const fetchAutomation = async () => {
    if (!user?.id || !isLoaded) return;
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const data = await res.json();
        setAutomationSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch automation:", err);
    }
  };

  useEffect(() => {
    fetchAutomation();
  }, [user?.id, isLoaded]);

  const fetchCredits = async () => {
    if (!user?.id || !isLoaded) return;
    try {
      const res = await fetch("/api/user/credits");
      if (res.ok) {
        const data: CreditsData = await res.json();
        setCreditsData(data);
        setTimeLeft(data.secondsUntilNextRegen);
      }
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    }
  };

  useEffect(() => {
    fetchCredits();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchCredits();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user?.id, isLoaded]);

  const refetchCredits = async () => {
    if (!user?.id) return;
    await fetchCredits();
  };

  const saveAutomation = async (settings: AutomationSettings) => {
    setLoading(true);
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setAutomationSettings(await res.json());
        alert("Settings saved successfully!");
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Error saving settings.");
    } finally {
      setLoading(false);
      setAutomationOpen(false);
    }
  };

  const testNow = async () => {
    if (!user?.id) return;
    if (!automationSettings?.isActive) return alert("Please activate automation first!");
    if (confirm("Simulate daily run now? This will deduct credits and create a new project.")) {
      try {
        const res = await fetch(`/api/cron/daily?test=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (res.ok) {
          alert("Test run triggered! Check your /projects page in 10 seconds.");
          refetchCredits();
        } else {
          const err = await res.text();
          alert(`Test failed: ${err || "Unknown error"}`);
        }
      } catch (err) {
        alert("Error: " + (err as Error).message);
      }
    }
  };

  const modelOptions: Record<ModelType, ModelOption> = {
    gemini: { label: "Gemini 2.0", icon: "/icons/gemini.png", color: "text-blue-400" },
    claude: { label: "Claude Sonnet 4.5", icon: "/icons/claude.png", color: "text-purple-400" },
    gpt: { label: "GPT-5", icon: "/icons/openai.png", color: "text-green-400" },
    deepseek: { label: "Deepseek R3", icon: "/icons/deepseek.png", color: "text-teal-400" },
    gptoss: { label: "GPT-OSS 20B", icon: "/icons/openai.png", color: "text-green-400" },
  };

  const parseTime = (utcTime24: string) => {
    if (!utcTime24) {
      const default_israel = utcToIsraelTime("11", "00", "00");
      return { ...default_israel, hour: default_israel.hour || 14 };
    }

    const parts = utcTime24.split(":");
    const israelTime = utcToIsraelTime(parts[0] || "11", parts[1] || "00", parts[2] || "00");
    return israelTime;
  };

  const currentParsed = automationSettings ? parseTime(automationSettings.dailyTime) : { hour: 14, minute: 0, second: 0, timezone: "UTC+2 (IST)" };

  const updateTime = (key: "hour" | "minute" | "second" | "ampm", val: number | string) => {
    if (!automationSettings) return;
    let newSettings = { ...automationSettings };

    const newUtcTime = israelTimeToUTC(
      key === "hour" ? Number(val) : currentParsed.hour,
      key === "minute" ? Number(val) : currentParsed.minute,
      key === "second" ? Number(val) : currentParsed.second,
    );

    newSettings.dailyTime = newUtcTime;
    setAutomationSettings(newSettings);
  };

  const handleSave = () => {
    if (automationSettings) saveAutomation(automationSettings);
  };

  const handleUpdateSettings = (updater: (prev: AutomationSettings) => AutomationSettings) => {
    setAutomationSettings((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, []);

  const openMenu = useCallback((menuKey: string) => {
    const triggerEl = triggerRefs.current[menuKey];
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const parentRect = triggerEl.closest('.relative')?.getBoundingClientRect() || { left: 0 };

    // Align left edge of dropdown with left edge of trigger (or center for avatar)
    const left = menuKey === 'user'
      ? rect.left - parentRect.left + rect.width / 2 - 110  // ~half of minWidth 220px
      : rect.left - parentRect.left;

    setDropdownLeft(Math.max(8, left)); // minimum padding from edge
    setActiveMenu(menuKey);
  }, []);

  const toggleMenu = useCallback((menuKey: string) => {
    if (activeMenu === menuKey) {
      setActiveMenu(null);
    } else {
      openMenu(menuKey);
    }
  }, [activeMenu, openMenu]);

  const closeDropdown = useCallback(() => {
    setActiveMenu(null);
  }, []);

  const handleMenuActionLocal = useCallback((action: string) => {
    if (action.startsWith('/')) {
      router.push(action);
      return;
    }
    switch (action) {
      case 'restart':
        window.location.reload(); // ← This refreshes the current page
        return;
      case 'logout':
        clerk.signOut();
        break;
      case 'manage-account':
        clerk.openUserProfile();
        break;
      case 'manage-ai':
        setAutomationOpen(true);
        break;
      default:
        onMenuAction?.(action);
    }
    closeDropdown();
  }, [onMenuAction, router, clerk, closeDropdown]);

  const userMenuItems: MenuItemOption[] = [
    {
      type: 'item',
      label: 'Projects',
      icon: <img src="/icons/project.png" className="opacity-80" width={20} alt="" />,
      action: '/projects',
    },
    {
      type: 'item',
      label: 'Privacy Policy',
      icon: <img src="/icons/privacy-policy.png" className="opacity-80" width={20} alt="" />,
      action: '/legal/privacy',
    },
    {
      type: 'item',
      label: <>Manage AI <Badge className="ml-1 bg-[#2e2e2e5d] text-white">Beta</Badge></>,
      icon: <Settings className="h-4 w-4 opacity-80" />,
      action: 'manage-ai',
    },
    {
      type: 'item',
      label: 'Manage Account',
      icon: <img src="/icons/user.png" className="opacity-80" width={20} alt="" />,
      action: 'manage-account',
    },
    {
      type: 'item',
      label: 'Logout',
      icon: <img src="/icons/logout.png" className="opacity-80" width={20} alt="" />,
      action: 'logout',
    },
  ];

  return (
    <div className="relative">
      <div
        className={`backdrop-blur-md border shadow-xs ${className}`}
        style={{
          height: '40px',
          borderRadius: '8px',
        }}
      >
        <div className="flex justify-between items-center h-full px-4">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Apple Logo */}
            <div
              ref={(el) => { triggerRefs.current['apple'] = el; }}
              onClick={() => toggleMenu('apple')}
              className="cursor-pointer hover:opacity-80 transition-opacity duration-150 mb-1"
            >
              <img src="/logo_light.png" width={100} alt="Logo" />
            </div>

            <Link href={'/pricing'}>
              <span className="text-black/80 hover:text-black/70 text-sm font-semibold">
                {appName}
              </span>
            </Link>
            <Link href={'/projects'}>
              <span className="text-black/80 hover:text-black/70 text-sm font-semibold">
                Projects
              </span>
            </Link>
            <Link href={'/templates'}>
              <span className="text-black/80 hover:text-black/70 text-sm font-semibold">
                Templates
              </span>
            </Link>
            <div className="flex items-center space-x-6">
              {menus.map((menu) => (
                <span
                  key={menu.label}
                  ref={(el) => { triggerRefs.current[menu.label] = el; }}
                  className="text-black text-sm cursor-pointer hover:opacity-80 transition-opacity duration-150 select-none"
                  onClick={() => toggleMenu(menu.label)}
                >
                  {menu.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative top-[-1.5px] flex items-center">
                {creditsData && (
                  <button
                    ref={(el) => { triggerRefs.current['credits'] = el; }}
                    onClick={() => toggleMenu('credits')}
                    className="text-black/90 text-[14px] mt-4 p-1 px-2.5 top-[-6px] relative hover:opacity-80"
                  >
                    <span className="flex items-center gap-2 rounded-md py-1">
                      <span>{creditsData.credits} credits</span>
                    </span>
                  </button>
                )}
                <button
                  ref={(el) => { triggerRefs.current['user'] = el; }}
                  onClick={() => toggleMenu('user')}
                  className="w-8 h-8 rounded-full overflow-hidden focus:outline-none cursor-pointer p-1"
                >
                  <img
                    src={user.imageUrl || "/placeholder.svg"}
                    alt={user.firstName || "User"}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            ) : (
              <>
                <Link href={"/sign-in"}>
                  <button className="text-sm font-medium cursor-pointer text-[#181717]">Sign In</button>
                </Link>
                <Link href={"/sign-up"}>
                  <button className="text-sm font-medium cursor-pointer w-[70px] bg-[#e7e7e7] p-1 rounded-md text-[#000000]">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dropdowns — all now properly positioned below their triggers */}
      <MenuDropdown
        isOpen={activeMenu === 'apple'}
        onClose={closeDropdown}
        items={APPLE_MENU_ITEMS}
        left={dropdownLeft}
        onAction={handleMenuActionLocal}
      />

      {menus.map((menu) => (
        <MenuDropdown
          key={menu.label}
          isOpen={activeMenu === menu.label}
          onClose={closeDropdown}
          items={menu.items}
          left={dropdownLeft}
          onAction={handleMenuActionLocal}
        />
      ))}

      <MenuDropdown
        isOpen={activeMenu === 'user'}
        onClose={closeDropdown}
        items={userMenuItems}
        left={dropdownLeft}
        onAction={handleMenuActionLocal}
      />

      {/* Optional: Credits dropdown if you want one later */}
      {/* <MenuDropdown
        isOpen={activeMenu === 'credits'}
        onClose={closeDropdown}
        items={[{ type: 'item', label: 'Buy more credits', action: '/pricing' }]}
        left={dropdownLeft}
        onAction={handleMenuActionLocal}
      /> */}

      <AutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        automationSettings={automationSettings}
        onUpdateSettings={handleUpdateSettings}
        onSave={handleSave}
        onTestNow={testNow}
        loading={loading}
        modelOptions={modelOptions}
        currentParsed={currentParsed}
        onUpdateTime={updateTime}
      />
    </div>
  );
};

export default MacOSMenuBar;