'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import Image from 'next/image';
import NotificationCenter from './NotificationCenter';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  actions?: React.ReactNode;
}

function getRoleLabel(systemRole: string | undefined): string {
  if (!systemRole) return 'Staff';
  if (systemRole === 'executive_director') return 'Director General';
  return systemRole
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AppLayout({ children, pageTitle, pageSubtitle, actions }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getDisplayName, getInitials, profile, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change (navigation)
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  useServiceWorker(); // Register SW and keep online/offline state in sync

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch {
      router.replace('/login');
    }
  };

  const roleLabel = getRoleLabel(profile?.systemRole);

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Sidebar — handles its own mobile overlay internally */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ml-0 ${
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        }`}
      >
        {/* Topbar */}
        <header className="h-14 sm:h-16 bg-white border-b border-border border-t-2 border-t-primary flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 sticky top-0 z-20">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-muted text-muted-foreground flex-shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="EcsaMenuIcon" size={20} />
          </button>

          {/* ECSA-HC Logo + Contact */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Image
              src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
              alt="ECSA-HC Logo"
              width={72}
              height={72}
              style={{ width: 'auto', height: 'auto' }}
              className="object-contain h-10 sm:h-14"
              priority
            />
            <div className="hidden md:flex flex-col leading-tight">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="EcsaPhoneIcon" size={12} className="text-primary flex-shrink-0" />
                <span>+255-27-2973677/8</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon name="EcsaEmailIcon" size={12} className="text-primary flex-shrink-0" />
                <span>regsec@ecsahc.org</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {pageTitle && (
              <div>
                <h1 className="text-sm sm:text-base font-700 text-foreground leading-tight truncate">{pageTitle}</h1>
                {pageSubtitle && <p className="text-[11px] sm:text-xs text-muted-foreground truncate hidden sm:block">{pageSubtitle}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {actions}
            <NotificationCenter />

            {/* User avatar + dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 pl-1 pr-1.5 sm:pr-2 py-1 rounded-full hover:bg-muted transition-colors"
                aria-label="User menu"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-700">{getInitials()}</span>
                </div>
                <div className="hidden md:flex flex-col items-start leading-tight">
                  <span suppressHydrationWarning className="text-xs font-600 text-foreground max-w-[120px] truncate">{getDisplayName()}</span>
                  <span suppressHydrationWarning className="text-[10px] text-muted-foreground max-w-[120px] truncate">{roleLabel}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-muted-foreground hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-border z-50 overflow-hidden">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <p suppressHydrationWarning className="text-sm font-600 text-foreground truncate">{getDisplayName()}</p>
                    <p suppressHydrationWarning className="text-xs text-muted-foreground truncate">{profile?.email || ''}</p>
                    <span suppressHydrationWarning className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-600">
                      {roleLabel}
                    </span>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); router.push('/change-password'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-screen-2xl mx-auto overflow-x-hidden">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-white mt-auto">
          <div className="h-1 bg-primary w-full" />
          <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                alt="ECSA-HC Logo"
                width={32}
                height={32}
                style={{ width: 'auto', height: 'auto' }}
                className="object-contain h-7"
              />
              <div className="leading-tight">
                <p className="text-xs font-700 text-foreground">ECSA-HC</p>
                <p className="text-[10px] text-muted-foreground">Performance Management System</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              © {currentYear} East, Central &amp; Southern Africa Health Community. All rights reserved.
            </p>
            <div className="hidden sm:flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon name="EcsaPhoneIcon" size={11} className="text-primary flex-shrink-0" />
                <span>+255-27-2973677/8</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon name="EcsaEmailIcon" size={11} className="text-primary flex-shrink-0" />
                <span>regsec@ecsahc.org</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}