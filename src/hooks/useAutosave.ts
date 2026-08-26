'use client';

import { useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  staffId: string | null;
  /** Pass a real workplan UUID, or null for drafts without a workplan yet */
  workplanId: string | null;
  draftType: string;
  reviewPeriod?: string;
  formData: Record<string, any>;
  activeStep?: number;
  enabled: boolean;
  onStatusChange: (status: AutosaveStatus) => void;
  debounceMs?: number;
}

/** Returns true if the string looks like a real UUID (not a fake "eval-draft-..." key) */
function isRealUUID(value: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function useAutosave({
  staffId,
  workplanId,
  draftType,
  reviewPeriod = 'annual',
  formData,
  activeStep = 0,
  enabled,
  onStatusChange,
  debounceMs = 3000,
}: UseAutosaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabaseRef = useRef(createClient());

  // Normalise workplanId: only pass real UUIDs to the DB
  const realWorkplanId = isRealUUID(workplanId) ? workplanId : null;

  const saveDraft = useCallback(
    async (silent = false) => {
      if (!enabled || !staffId) return;
      if (!silent) onStatusChange('saving');
      try {
        const supabase = supabaseRef.current;

        if (realWorkplanId) {
          // Has a real workplan ID — upsert using the unique index
          // idx_appraisal_drafts_upsert_key: (staff_id, workplan_id, draft_type, review_period)
          const { error } = await supabase.from('appraisal_drafts').upsert(
            {
              staff_id: staffId,
              workplan_id: realWorkplanId,
              draft_type: draftType,
              review_period: reviewPeriod,
              form_data: formData,
              active_step: activeStep,
              last_saved_at: new Date().toISOString(),
            },
            { onConflict: 'staff_id,workplan_id,draft_type,review_period' }
          );
          if (!error) {
            onStatusChange('saved');
            setTimeout(() => onStatusChange('idle'), 3000);
          } else {
            console.error('Autosave error (with workplan):', error.message);
            onStatusChange('error');
          }
        } else {
          // No real workplan ID — upsert using the partial unique index
          // idx_appraisal_drafts_null_workplan_key: (staff_id, draft_type, review_period) WHERE workplan_id IS NULL
          // Supabase upsert with ignoreDuplicates=false will UPDATE on conflict
          const { error } = await supabase.from('appraisal_drafts').upsert(
            {
              staff_id: staffId,
              workplan_id: null,
              draft_type: draftType,
              review_period: reviewPeriod,
              form_data: formData,
              active_step: activeStep,
              last_saved_at: new Date().toISOString(),
            },
            { onConflict: 'staff_id,draft_type,review_period', ignoreDuplicates: false }
          );
          if (!error) {
            onStatusChange('saved');
            setTimeout(() => onStatusChange('idle'), 3000);
          } else {
            console.error('Autosave error (no workplan):', error.message);
            onStatusChange('error');
          }
        }
      } catch (err) {
        console.error('Autosave exception:', err);
        onStatusChange('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, staffId, realWorkplanId, draftType, reviewPeriod, activeStep, JSON.stringify(formData)]
  );

  // Debounced auto-save on form data change
  useEffect(() => {
    if (!enabled || !staffId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDraft(true), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(formData), activeStep, enabled, staffId, realWorkplanId]);

  const recoverDraft = useCallback(
    async (wpId: string | null, sId: string, period: string) => {
      try {
        const supabase = supabaseRef.current;
        const realWpId = isRealUUID(wpId) ? wpId : null;

        let query = supabase
          .from('appraisal_drafts')
          .select('*')
          .eq('staff_id', sId)
          .eq('draft_type', draftType)
          .eq('review_period', period)
          .order('last_saved_at', { ascending: false })
          .limit(1);

        if (realWpId) {
          query = query.eq('workplan_id', realWpId);
        } else {
          query = query.is('workplan_id', null);
        }

        const { data } = await query.maybeSingle();
        return data ?? null;
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftType]
  );

  const clearDraft = useCallback(
    async (wpId: string | null, sId: string, period: string) => {
      try {
        const supabase = supabaseRef.current;
        const realWpId = isRealUUID(wpId) ? wpId : null;

        let query = supabase
          .from('appraisal_drafts')
          .delete()
          .eq('staff_id', sId)
          .eq('draft_type', draftType)
          .eq('review_period', period);

        if (realWpId) {
          query = query.eq('workplan_id', realWpId);
        } else {
          query = query.is('workplan_id', null);
        }

        await query;
      } catch {
        // silently fail
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftType]
  );

  return { saveDraft, recoverDraft, clearDraft };
}

/** Renders the autosave status badge — import and use in any form header */
export function autosaveStatusLabel(status: AutosaveStatus): string {
  switch (status) {
    case 'saving': return 'Saving draft…';
    case 'saved': return 'Draft saved';
    case 'error': return 'Save failed';
    default: return 'Auto-save on';
  }
}
