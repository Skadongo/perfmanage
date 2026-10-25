'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';


interface RoleGuardProps {
  children: React.ReactNode;
  /** Minimum role level required (default: 50 = programme_officer) */
  minLevel?: number;
  /** Custom message to show when access is denied */
  message?: string;
}

/**
 * RoleGuard — wraps sensitive content and blocks access based on role level.
 * Role levels: executive_director=100, deputy_director=90, hr_admin_officer=80,
 * programme_manager/finance_manager=70, programme_officer/finance_officer/admin_officer=50,
 * project_coordinator=40, staff_member=30
 */
export default function RoleGuard({ children, minLevel = 50, message }: RoleGuardProps) {
  const { loading, user, getRoleLevel, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const level = getRoleLevel();
  const systemRole = profile?.systemRole || '';

  // Support admin, Director General and Director of Operations & Institutional Development
  // always have full unrestricted access to all screens
  const isDirectorLevel =
    systemRole === 'superuser' ||
    systemRole === 'support_admin' ||
    systemRole === 'executive_director' ||
    systemRole === 'deputy_director';

  if (!isDirectorLevel && level < minLevel) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-700 text-foreground mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mb-1">
            {message || 'You do not have permission to view this page.'}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Your role: <span className="font-600 text-foreground">
              {(profile?.systemRole || 'staff_member').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </p>
          <button
            onClick={() => router.push('/performance-dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
