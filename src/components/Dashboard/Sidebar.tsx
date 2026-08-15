"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { NAV_ITEMS } from "@/src/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Home,
  Mic,
  Code2,
  Bot,
  LogOut,
  Menu,
  ChevronRight,
  Gift,
  MoreVertical,
  Volume2,
  FileText,
} from "lucide-react";

const iconMap = {
  Home,
  FileText,
  Mic,
  Code2,
  Bot,
  Volume2,
} as const;

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full bg-[#FCFCFC] border-r border-[#ECECEC]">
      {/* Logo */}
      <div className="px-5 py-3.5 border-b border-[#ECECEC]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="white"
              />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-[#111111]">Intervue</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 mt-6">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.iconName];
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ease-in-out group",
                isActive
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-[#6B7280] font-medium hover:bg-[#F7F7F7] hover:text-[#111111]"
              )}
            >
              <Icon
                className={cn(
                  "w-[16px] h-[16px] flex-shrink-0",
                  isActive
                    ? "text-blue-500"
                    : "text-[#9CA3AF] group-hover:text-[#6B7280]"
                )}
              />
              <span className="truncate font-light">{item.label}</span>
            </Link>
          );
        })}
      </nav>


      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-[#ECECEC] pt-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
            <AvatarFallback className="text-xs bg-blue-50 text-blue-500 font-medium">
              {user?.name ? getInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#111111] truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-[#9CA3AF] truncate">
              {user?.email || "user@example.com"}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-colors duration-150 text-[#9CA3AF] cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[260px] h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Button */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <button className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg border border-[#ECECEC]">
              <Menu className="w-5 h-5 text-[#6B7280]" />
            </button>
          }
        />
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarContent onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
