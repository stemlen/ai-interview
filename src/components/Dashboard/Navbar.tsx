"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/src/components/providers/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, LogOut, FileText, CheckCircle2, User as UserIcon, X } from "lucide-react";
import { ROUTES } from "@/src/constants";

export function Navbar() {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: "Welcome to Intervue AI",
      message: "Start your first mock interview or review past assignments.",
      time: "Just now",
      read: false,
    },
    {
      id: "2",
      title: "Assessment Ready",
      message: "Try our new proctored end-to-end interview simulation.",
      time: "1 hour ago",
      read: false,
    },
  ]);

  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-14 border-b border-[#ECECEC] bg-white/80 backdrop-blur-md sticky top-0 z-30">
      <div
        ref={navRef}
        className="flex items-center justify-end h-full px-6 lg:px-8 relative"
      >
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              aria-label="Toggle notifications"
              className="relative p-2 rounded-lg hover:bg-[#F7F7F7] text-[#6B7280] hover:text-[#111111] transition-colors duration-150 cursor-pointer"
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-[#ECECEC] shadow-xl p-4 z-50 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-[#ECECEC]">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-[#111111]">
                      Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto py-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`py-3 px-1 text-xs space-y-1 ${
                          !n.read ? "bg-blue-50/40 rounded-lg px-2 my-1" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#111111]">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-gray-400">{n.time}</span>
                        </div>
                        <p className="text-[#6B7280] leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-[#ECECEC] text-center">
                  <Link
                    href={ROUTES.ASSIGNMENTS}
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-blue-600 hover:underline font-medium inline-block"
                  >
                    View All Assessments
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              aria-label="User menu"
              className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <Avatar className="w-8 h-8 ring-1 ring-[#ECECEC] cursor-pointer hover:opacity-90 transition-opacity">
                <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                <AvatarFallback className="text-xs bg-blue-50 text-blue-500 font-medium">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </button>

            {/* User Profile Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-[#ECECEC] shadow-xl py-2 z-50 animate-in fade-in-50 duration-150">
                <div className="px-4 py-2 border-b border-[#ECECEC]">
                  <p className="text-xs font-semibold text-[#111111] truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {user?.email || "user@example.com"}
                  </p>
                </div>

                <div className="py-1">
                  <Link
                    href={ROUTES.ASSIGNMENTS}
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#6B7280] hover:text-[#111111] hover:bg-[#F7F7F7] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Past Assignments
                  </Link>
                  <Link
                    href={ROUTES.INTERVIEW}
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#6B7280] hover:text-[#111111] hover:bg-[#F7F7F7] transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    New Assessment
                  </Link>
                </div>

                <div className="border-t border-[#ECECEC] pt-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

