'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// Role hierarchy for access control
export const ROLE_HIERARCHY: Record<string, number> = {
  superuser: 120,
  support_admin: 110,
  executive_director: 100,
  deputy_director: 90,
  hr_admin_officer: 80,
  programme_manager: 70,
  finance_manager: 70,
  programme_officer: 50,
  finance_officer: 50,
  admin_officer: 50,
  project_coordinator: 40,
  staff_member: 30,
};

// Sensitive screens that require elevated access
export const SENSITIVE_SCREENS = [
  'performance-dashboard',
  'analytics-reports',
  'appraisal-audit-trail',
  'staff-management',
  'permissions',
];

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  systemRole: string;
  department?: string;
  jobTitle?: string;
  avatarInitials?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  staffId?: string;
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  // Role-based helpers
  isHROrDirector: () => boolean;
  isManagerOrAbove: () => boolean;
  canViewSensitiveData: () => boolean;
  getRoleLevel: () => number;
  getDisplayName: () => string;
  getInitials: () => string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ── In-memory profile cache ──────────────────────────────────────────────────
// Caches the user profile after first fetch so role-guard and permission checks
// on subsequent page transitions read from memory (<1ms) instead of hitting DB.
interface ProfileCacheEntry {
  profile: UserProfile;
  fetchedAt: number;
}
const PROFILE_CACHE_TTL = 5 * 60_000; // 5 minutes
const profileCache = new Map<string, ProfileCacheEntry>();

function getCachedProfile(userId: string): UserProfile | null {
  const entry = profileCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > PROFILE_CACHE_TTL) {
    profileCache.delete(userId);
    return null;
  }
  return entry.profile;
}

function setCachedProfile(userId: string, profile: UserProfile): void {
  profileCache.set(userId, { profile, fetchedAt: Date.now() });
}

function clearCachedProfile(userId?: string): void {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Use a ref so the supabase client is stable across renders
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  // Track whether initial session load already fetched the profile
  const initialLoadDone = useRef(false);

  const fetchProfile = async (userId: string, authUser?: any, forceRefresh = false): Promise<UserProfile | null> => {
    // Return cached profile immediately if available and not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedProfile(userId);
      if (cached) return cached;
    }

    try {
      // Only fetch user_profiles — skip the redundant getUser() call when authUser is already provided
      const profileResult = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, system_role, department, job_title, avatar_initials, is_active, must_change_password, staff_id')
        .eq('id', userId)
        .maybeSingle();

      // Only call getUser if authUser was not passed in (avoids a round-trip on every auth event)
      const resolvedAuthUser = authUser ?? (await supabase.auth.getUser()).data?.user;

      const data = profileResult.data;

      if (!data && !resolvedAuthUser) return null;

      const metaSystemRole =
        resolvedAuthUser?.user_metadata?.system_role ||
        resolvedAuthUser?.app_metadata?.system_role ||
        '';

      const profileSystemRole = data?.system_role || '';

      const resolvedSystemRole =
        (metaSystemRole && metaSystemRole !== 'staff_member'
          ? metaSystemRole
          : null) ||
        (profileSystemRole && profileSystemRole !== 'staff_member'
          ? profileSystemRole
          : null) ||
        metaSystemRole ||
        profileSystemRole ||
        'staff_member';

      const metaRole = resolvedAuthUser?.user_metadata?.role || '';
      const resolvedRole =
        data?.role ||
        (metaRole === 'admin' || metaRole === 'manager' || metaRole === 'staff'
          ? metaRole
          : 'staff');

      const userProfile: UserProfile = {
        id: userId,
        email: data?.email || resolvedAuthUser?.email || '',
        fullName:
          data?.full_name ||
          resolvedAuthUser?.user_metadata?.full_name ||
          resolvedAuthUser?.email?.split('@')[0] ||
          '',
        role: resolvedRole,
        systemRole: resolvedSystemRole,
        department: data?.department || '',
        jobTitle: data?.job_title || '',
        avatarInitials: data?.avatar_initials || '',
        isActive: data?.is_active ?? true,
        mustChangePassword: data?.must_change_password ?? false,
        staffId: data?.staff_id || undefined,
      };

      // Cache the profile after successful fetch
      setCachedProfile(userId, userProfile);
      return userProfile;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Initial session load — do this once
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
      initialLoadDone.current = true;
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the first SIGNED_IN event that fires right after getSession
      // to avoid a redundant double-fetch on page load
      if (event === 'SIGNED_IN' && !initialLoadDone.current) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Only re-fetch profile on meaningful auth events; force refresh to get fresh data
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const forceRefresh = event === 'USER_UPDATED';
          const p = await fetchProfile(session.user.id, session.user, forceRefresh);
          setProfile(p);
        }
      } else {
        // Clear cache on sign out
        if (session === null) {
          clearCachedProfile();
        }
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: (metadata as any)?.fullName || '',
          avatar_url: (metadata as any)?.avatarUrl || '',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Sign Out — clear profile cache
  const signOut = async () => {
    const userId = user?.id;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearCachedProfile(userId);
    setProfile(null);
  };

  // Get Current User
  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    return fetchProfile(user.id);
  };

  // Role-based helpers
  const isHROrDirector = (): boolean => {
    const role = profile?.systemRole || '';
    return ['executive_director', 'deputy_director', 'hr_admin_officer'].includes(role);
  };

  const isManagerOrAbove = (): boolean => {
    const level = getRoleLevel();
    return level >= 70;
  };

  const canViewSensitiveData = (): boolean => {
    const level = getRoleLevel();
    return level >= 50;
  };

  const getRoleLevel = (): number => {
    const role = profile?.systemRole || 'staff_member';
    return ROLE_HIERARCHY[role] ?? 30;
  };

  const getDisplayName = (): string => {
    return profile?.fullName || user?.email?.split('@')[0] || 'User';
  };

  const getInitials = (): string => {
    if (profile?.avatarInitials) return profile.avatarInitials;
    const name = getDisplayName();
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        getCurrentUser,
        isEmailVerified,
        getUserProfile,
        isHROrDirector,
        isManagerOrAbove,
        canViewSensitiveData,
        getRoleLevel,
        getDisplayName,
        getInitials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
