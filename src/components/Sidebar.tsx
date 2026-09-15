'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const NAV_GROUPS = [
{
  label: 'Performance',
  items: [
  { label: 'Performance Dashboard', href: '/performance-dashboard', icon: 'EcsaPerformanceIcon', badge: null },
  { label: 'Evaluation & Reviews', href: '/evaluation-reviews', icon: 'EcsaEvaluationIcon', badge: null },
  { label: 'Mid-Year Reviews', href: '/mid-year-reviews', icon: 'EcsaMidYearIcon', badge: null },
  { label: 'Self-Assessment', href: '/self-assessment', icon: 'ClipboardDocumentListIcon', badge: null },
  { label: 'Manager Review', href: '/manager-review', icon: 'ClipboardDocumentCheckIcon', badge: null }]
},
{
  label: 'Development',
  items: [
  { label: 'Feedback & Mentorship', href: '/feedback-mentorship', icon: 'EcsaFeedbackIcon', badge: null },
  { label: 'Training & Resources', href: '/training-resources', icon: 'EcsaTrainingIcon', badge: null }]
},
{
  label: 'Organisation',
  items: [
  { label: 'Staff Management', href: '/staff-management', icon: 'EcsaStaffIcon', badge: null },
    { label: 'Appraisal Audit Trail', href: '/appraisal-audit-trail', icon: 'ClipboardDocumentListIcon', badge: null },
  { label: 'Permissions', href: '/permissions', icon: 'EcsaPermissionsIcon', badge: null },
  { label: 'Admin Dashboard', href: '/admin-dashboard', icon: 'ShieldCheckIcon', badge: null }]
},
{
  label: 'Intelligence',
  items: [
  { label: 'Analytics & Reports', href: '/analytics-reports', icon: 'EcsaAnalyticsIcon', badge: null },
  { label: 'System Health', href: '/system-health', icon: 'ServerStackIcon', badge: null }]
},
{
  label: 'Support',
  items: [
  { label: 'Help & User Manual', href: '/help', icon: 'BookOpenIcon', badge: null },
  { label: 'User Manual (Full)', href: '/user-manual', icon: 'DocumentTextIcon', badge: null }]
}];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile: whether the drawer is open */
  mobileOpen?: boolean;
  /** Mobile: close the drawer */
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { getDisplayName, getInitials, profile } = useAuth();

  const roleLabel = profile?.systemRole
    ? profile.systemRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Staff Member';

  return (
    <>
      {/* Mobile overlay backdrop - always rendered, visibility controlled by CSS */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={`
          fixed left-0 top-0 h-screen bg-white border-r border-border z-40
          flex flex-col transition-all duration-300 ease-in-out
          /* Desktop: always visible, width controlled by collapsed */
          lg:translate-x-0
          /* Mobile: slide in/out as drawer */
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          /* Width: full on mobile drawer, icon-only or full on desktop */
          w-72 sm:w-64 lg:w-auto
          ${collapsed ? 'lg:w-16' : 'lg:w-60'}
        `}
      >
        {/* Brand accent top bar */}
        <div className="h-1 bg-primary w-full flex-shrink-0" />

        {/* Logo */}
        <div className={`flex items-center border-b border-border h-[60px] px-3 ${collapsed ? 'lg:justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <AppLogo size={48} />
            {/* Always show label on mobile drawer; hide when collapsed on desktop */}
            <span className={`font-sans font-700 text-sm text-foreground truncate leading-tight ${collapsed ? 'lg:hidden' : ''}`}>
              ECSA-HC
              <span className="block text-[10px] font-400 text-muted-foreground">PMS</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop collapse toggle */}
            {!collapsed && (
              <button
                onClick={onToggle}
                className="hidden lg:flex p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Collapse sidebar"
              >
                <Icon name="EcsaCollapseIcon" size={16} />
              </button>
            )}
            {/* Mobile close button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close menu"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {/* Desktop collapse toggle when collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="hidden lg:flex mx-auto mt-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Expand sidebar"
          >
            <Icon name="EcsaExpandIcon" size={16} />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          {NAV_GROUPS.map((group) =>
          <div key={`group-${group.label}`} className="mb-4">
              {/* Show group label on mobile always; on desktop only when not collapsed */}
              {(!collapsed || mobileOpen) && (
                <p className="px-4 mb-1 text-[10px] font-600 uppercase tracking-widest text-primary/60 lg:block">
                  {group.label}
                </p>
              )}
              {collapsed && !mobileOpen && (
                <p className="hidden lg:block px-4 mb-1 text-[10px] font-600 uppercase tracking-widest text-primary/60 opacity-0 select-none">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={`nav-${item.href}`}
                  href={item.href}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                  onClick={onMobileClose}
                  className={`
                      relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-500
                      transition-all duration-150 group
                      ${isActive ?
                  'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent'}
                      ${collapsed && !mobileOpen ? 'lg:justify-center' : ''}
                    `}
                >
                    <Icon
                    name={item.icon as Parameters<typeof Icon>[0]['name']}
                    size={18}
                    className={isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} />

                    {/* Show label on mobile always; on desktop only when not collapsed */}
                    <span className={`flex-1 truncate ${collapsed && !mobileOpen ? 'lg:hidden' : ''}`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={`${collapsed && !mobileOpen ? 'lg:absolute lg:top-1 lg:right-1 lg:w-4 lg:h-4 lg:flex lg:items-center lg:justify-center' : 'ml-auto'} bg-primary text-white text-[10px] font-700 rounded-full px-1.5 py-0.5 leading-none tabular-nums`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>);
            })}
            </div>
          )}
        </nav>

        {/* User */}
        <div className={`border-t border-border p-3 ${collapsed && !mobileOpen ? 'lg:flex lg:justify-center' : ''}`}>
          {collapsed && !mobileOpen ? (
            <div className="hidden lg:flex w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
              <span className="text-primary text-xs font-700">{getInitials()}</span>
            </div>
          ) : null}
          <div className={`flex items-center gap-2 ${collapsed && !mobileOpen ? 'lg:hidden' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary text-xs font-700">{getInitials()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-600 text-foreground truncate">{getDisplayName()}</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel}</p>
            </div>
            <button className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
              <Icon name="EcsaSettingsIcon" size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}