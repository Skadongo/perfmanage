'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  cacheGet,
  cacheSet,
  cacheGetStale,
  TTL_STAFF_LIST,
  TTL_BSC_PERSPECTIVES,
  TTL_REFERENCE_DATA,
} from '@/lib/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RefStaff {
  id: string;
  full_name: string;
  job_title: string;
  department_id: string | null;
  employment_status: string;
  system_role: string | null;
  email: string | null;
}

export interface RefDepartment {
  id: string;
  name: string;
}

export interface RefBscPerspective {
  id: string;
  name: string;
  code: string;
  weight: number;
}

interface ReferenceDataContextType {
  staff: RefStaff[];
  departments: RefDepartment[];
  bscPerspectives: RefBscPerspective[];
  staffLoading: boolean;
  deptLoading: boolean;
  bscLoading: boolean;
  refreshStaff: () => Promise<void>;
  refreshDepts: () => Promise<void>;
}

const ReferenceDataContext = createContext<ReferenceDataContextType>({
  staff: [],
  departments: [],
  bscPerspectives: [],
  staffLoading: true,
  deptLoading: true,
  bscLoading: true,
  refreshStaff: async () => {},
  refreshDepts: async () => {},
});

export const useReferenceData = () => useContext(ReferenceDataContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<RefStaff[]>(() => cacheGetStale<RefStaff[]>('ref:staff') ?? []);
  const [departments, setDepartments] = useState<RefDepartment[]>(() => cacheGetStale<RefDepartment[]>('ref:departments') ?? []);
  const [bscPerspectives, setBscPerspectives] = useState<RefBscPerspective[]>(() => cacheGetStale<RefBscPerspective[]>('ref:bsc') ?? []);
  const [staffLoading, setStaffLoading] = useState(staff.length === 0);
  const [deptLoading, setDeptLoading] = useState(departments.length === 0);
  const [bscLoading, setBscLoading] = useState(bscPerspectives.length === 0);
  const supabaseRef = useRef(createClient());
  const isMounted = useRef(true);

  const fetchStaff = useCallback(async (force = false) => {
    const supabase = supabaseRef.current;
    const cached = force ? null : cacheGet<RefStaff[]>('ref:staff');
    if (cached) {
      if (isMounted.current) { setStaff(cached); setStaffLoading(false); }
      return;
    }
    try {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name, job_title, department_id, employment_status, system_role, email')
        .eq('employment_status', 'active')
        .order('full_name');
      const result = (data as RefStaff[]) ?? [];
      cacheSet('ref:staff', result, TTL_STAFF_LIST);
      if (isMounted.current) setStaff(result);
    } catch {}
    finally { if (isMounted.current) setStaffLoading(false); }
  }, []);

  const fetchDepts = useCallback(async (force = false) => {
    const supabase = supabaseRef.current;
    const cached = force ? null : cacheGet<RefDepartment[]>('ref:departments');
    if (cached) {
      if (isMounted.current) { setDepartments(cached); setDeptLoading(false); }
      return;
    }
    try {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      const result = (data as RefDepartment[]) ?? [];
      cacheSet('ref:departments', result, TTL_REFERENCE_DATA);
      if (isMounted.current) setDepartments(result);
    } catch {}
    finally { if (isMounted.current) setDeptLoading(false); }
  }, []);

  const fetchBsc = useCallback(async () => {
    const supabase = supabaseRef.current;
    const cached = cacheGet<RefBscPerspective[]>('ref:bsc');
    if (cached) {
      if (isMounted.current) { setBscPerspectives(cached); setBscLoading(false); }
      return;
    }
    try {
      const { data } = await supabase
        .from('bsc_perspectives')
        .select('id, name, code, weight')
        .order('name');
      const result = (data as RefBscPerspective[]) ?? [];
      cacheSet('ref:bsc', result, TTL_BSC_PERSPECTIVES);
      if (isMounted.current) setBscPerspectives(result);
    } catch {}
    finally { if (isMounted.current) setBscLoading(false); }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    // Fire all three reference data fetches in parallel
    Promise.all([fetchStaff(), fetchDepts(), fetchBsc()]);
    return () => { isMounted.current = false; };
  }, [fetchStaff, fetchDepts, fetchBsc]);

  return (
    <ReferenceDataContext.Provider
      value={{
        staff,
        departments,
        bscPerspectives,
        staffLoading,
        deptLoading,
        bscLoading,
        refreshStaff: () => fetchStaff(true),
        refreshDepts: () => fetchDepts(true),
      }}
    >
      {children}
    </ReferenceDataContext.Provider>
  );
}
