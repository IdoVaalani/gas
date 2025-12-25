
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileText,
  Receipt,
  BarChart3,
  Flame,
  Package,
  Clock,
  Menu,
  X,
  LogOut,
  User,
  Database // Added Database icon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigationItems = [
  {
    title: "דשבורד",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "לקוחות",
    url: createPageUrl("Customers"),
    icon: Users,
  },
  {
    title: "טכנאים",
    url: createPageUrl("Technicians"),
    icon: Wrench,
  },
  {
    title: "פריטים",
    url: createPageUrl("Items"),
    icon: Package,
  },
  {
    title: "הצעות מחיר",
    url: createPageUrl("Quotes"),
    icon: FileText,
  },
  {
    title: "חשבון",
    url: createPageUrl("Invoices"),
    icon: Receipt,
  },
  {
    title: "דוחות",
    url: createPageUrl("Reports"),
    icon: BarChart3,
  },
  {
    title: "גיבוי מערכת",
    url: createPageUrl("SystemBackup"),
    icon: Database,
  },
];

function IsraeliClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = () => {
    return time.toLocaleTimeString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = () => {
    return time.toLocaleDateString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
      <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
      <div className="text-right">
        <div className="text-sm md:text-lg font-bold text-blue-900">{formatTime()}</div>
        <div className="text-[10px] md:text-xs text-blue-700 hidden sm:block">{formatDate()}</div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50" dir="rtl">
        {/* Desktop Sidebar */}
        <Sidebar side="right" className="hidden lg:flex border-l border-gray-200">
          <SidebarHeader className="border-b border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Amisra Shaltiel</h2>
                <p className="text-xs text-gray-500">ניהול התקנות גז</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-500 px-2 py-2">
                תפריט ראשי
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2">
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <div className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Amisra Shaltiel</h2>
                <p className="text-[10px] text-gray-500">ניהול התקנות גז</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-2 py-2 mb-1">
              תפריט ראשי
            </div>
            {navigationItems.map((item) => (
              <Link
                key={item.title}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors ${
                  location.pathname === item.url
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-30">
            {/* Right Group (in RTL) - Mobile menu, Sidebar trigger, Logo & Title */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop Sidebar Trigger */}
              <SidebarTrigger className="hidden lg:block hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />

              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Flame className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <h1 className="text-base md:text-xl font-bold text-gray-900">Amisra Shaltiel</h1>
              </div>
            </div>

            {/* Center Item - Israeli Clock */}
            <IsraeliClock />

            {/* Left Group (in RTL) - User display and Logout Button */}
            <div className="flex items-center gap-2 md:gap-3">
              {currentUser && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">{currentUser.full_name}</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => base44.auth.logout()}
                className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              >
                <span className="hidden sm:inline">יציאה</span>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
