'use client';

import { useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CachedStaffMember {
  id: string;
  serial_number: number | null;
  full_name: string;
  job_title: string;
  department_id: string | null;
  supervisor_id: string | null;
  supervisor_name: string | null;
  employment_status: string;
  email: string | null;
  system_role: string | null;
  department_name: string | null;
}

interface StaffCacheEntry {
  data: CachedStaffMember[];
  fetchedAt: number;
}

// Module-level cache — survives component re-mounts within the same session
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let moduleCache: StaffCacheEntry | null = null;

export function useStaffCache() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  /**
   * Returns cached staff list if fresh, otherwise fetches from Supabase.
   * Selects only the columns needed by most screens.
   */
  const getStaff = useCallback(
    async (forceRefresh = false): Promise<CachedStaffMember[]> => {
      const now = Date.now();

      if (
        !forceRefresh &&
        moduleCache &&
        now - moduleCache.fetchedAt < CACHE_TTL_MS
      ) {
        return moduleCache.data;
      }

      const { data, error } = await supabase
        .from('staff')
        .select(
          'id, serial_number, full_name, job_title, department_id, supervisor_id, supervisor_name, employment_status, email, system_role, departments(name)'
        )
        .order('serial_number', { ascending: true });

      if (error) throw error;

      const mapped: CachedStaffMember[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        serial_number: row.serial_number as number | null,
        full_name: row.full_name as string,
        job_title: row.job_title as string,
        department_id: row.department_id as string | null,
        supervisor_id: row.supervisor_id as string | null,
        supervisor_name: row.supervisor_name as string | null,
        employment_status: row.employment_status as string,
        email: row.email as string | null,
        system_role: row.system_role as string | null,
        department_name:
          (row.departments as { name?: string } | null)?.name ?? null,
      }));

      moduleCache = { data: mapped, fetchedAt: now };
      return mapped;
    },
    [supabase]
  );

  /** Invalidate the cache (call after creating/updating staff records) */
  const invalidateCache = useCallback(() => {
    moduleCache = null;
  }, []);

  return { getStaff, invalidateCache };
}
