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
  { label: 'Help & User Manual', href: '/help', icon: 'BookOpenIcon', badge: null }]

}];


interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { getDisplayName, getInitials, profile } = useAuth();

  const roleLabel = profile?.systemRole
    ? profile.systemRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Staff Member';

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white border-r border-border z-40
        flex flex-col transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}>

      {/* Brand accent top bar */}
      <div className="h-1 bg-primary w-full flex-shrink-0" />

      {/* Logo */}
      <div className={`flex items-center border-b border-border h-[60px] px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed &&
        <div className="flex items-center gap-2 min-w-0">
            <AppLogo size={32} />
            <span className="font-sans font-700 text-sm text-foreground truncate leading-tight">
              ECSA-HC
              <span className="block text-[10px] font-400 text-muted-foreground">PMS</span>
            </span>
          </div>
        }
        {collapsed && <AppLogo size={32} />}
        {!collapsed &&
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse sidebar">

            <Icon name="EcsaCollapseIcon" size={16} />
          </button>
        }
      </div>

      {/* Collapse toggle when collapsed */}
      {collapsed &&
      <button
        onClick={onToggle}
        className="mx-auto mt-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Expand sidebar">

          <Icon name="EcsaExpandIcon" size={16} />
        </button>
      }

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {NAV_GROUPS.map((group) =>
        <div key={`group-${group.label}`} className="mb-4">
            {!collapsed &&
          <p className="px-4 mb-1 text-[10px] font-600 uppercase tracking-widest text-primary/60">
                {group.label}
              </p>
          }
            {group.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={`nav-${item.href}`}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`
                    relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-500
                    transition-all duration-150 group
                    ${isActive ?
                'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent'}
                    ${
                collapsed ? 'justify-center' : ''}
                  `}>

                  <Icon
                  name={item.icon as Parameters<typeof Icon>[0]['name']}
                  size={18}
                  className={isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'} />

                  {!collapsed &&
                <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge &&
                  <span className="ml-auto bg-primary text-white text-[10px] font-700 rounded-full px-1.5 py-0.5 leading-none tabular-nums">
                          {item.badge}
                        </span>
                  }
                    </>
                }
                  {collapsed && item.badge &&
                <span className="absolute top-1 right-1 bg-primary text-white text-[9px] font-700 rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {item.badge}
                    </span>
                }
                </Link>);

          })}
          </div>
        )}
      </nav>

      {/* User */}
      <div className={`border-t border-border p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ?
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xs font-700">{getInitials()}</span>
          </div> :

        <div className="flex items-center gap-2">
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
        }
      </div>
    </aside>);

}