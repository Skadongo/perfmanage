'use client';

import { useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  staffId: string | null;
  workplanId: string | null;
  draftType: string;
  reviewPeriod?: string;
  formData: Record<string, any>;
  activeStep?: number;
  enabled: boolean;
  onStatusChange: (status: AutosaveStatus) => void;
  debounceMs?: number;
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

  // Always-current refs so the debounced callback never captures stale values
  const formDataRef = useRef(formData);
  const activeStepRef = useRef(activeStep);
  const staffIdRef = useRef(staffId);
  const workplanIdRef = useRef(workplanId);
  const enabledRef = useRef(enabled);
  const reviewPeriodRef = useRef(reviewPeriod);

  // Keep refs in sync on every render
  formDataRef.current = formData;
  activeStepRef.current = activeStep;
  staffIdRef.current = staffId;
  workplanIdRef.current = workplanId;
  enabledRef.current = enabled;
  reviewPeriodRef.current = reviewPeriod;

  const saveDraft = useCallback(
    async (silent = false) => {
      // Read from refs so we always have the latest values
      const currentEnabled = enabledRef.current;
      const currentStaffId = staffIdRef.current;
      const currentWorkplanId = workplanIdRef.current;
      const currentFormData = formDataRef.current;
      const currentActiveStep = activeStepRef.current;
      const currentReviewPeriod = reviewPeriodRef.current;

      if (!currentEnabled || !currentStaffId) return;
      if (!silent) onStatusChange('saving');

      try {
        const supabase = supabaseRef.current;

        if (currentWorkplanId) {
          // Has a real workplan ID — upsert with workplan_id
          const { error } = await supabase.from('appraisal_drafts').upsert(
            {
              staff_id: currentStaffId,
              workplan_id: currentWorkplanId,
              draft_type: draftType,
              review_period: currentReviewPeriod,
              form_data: currentFormData,
              active_step: currentActiveStep,
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
          // No real workplan ID yet — upsert using staff_id + draft_type + review_period
          // Use a two-step approach: try upsert on the unique partial index
          // First check if a null-workplan draft exists, then update or insert
          const { data: existing, error: selectErr } = await supabase
            .from('appraisal_drafts')
            .select('id')
            .eq('staff_id', currentStaffId)
            .eq('draft_type', draftType)
            .eq('review_period', currentReviewPeriod)
            .is('workplan_id', null)
            .maybeSingle();

          if (selectErr) {
            console.error('Autosave select error:', selectErr.message);
            onStatusChange('error');
            return;
          }

          const updatePayload = {
            form_data: currentFormData,
            active_step: currentActiveStep,
            last_saved_at: new Date().toISOString(),
          };

          let saveError: any = null;

          if (existing?.id) {
            const { error } = await supabase
              .from('appraisal_drafts')
              .update(updatePayload)
              .eq('id', existing.id);
            saveError = error;
          } else {
            const { error } = await supabase.from('appraisal_drafts').insert({
              staff_id: currentStaffId,
              workplan_id: null,
              draft_type: draftType,
              review_period: currentReviewPeriod,
              ...updatePayload,
            });
            saveError = error;
          }

          if (!saveError) {
            onStatusChange('saved');
            setTimeout(() => onStatusChange('idle'), 3000);
          } else {
            console.error('Autosave error (no workplan):', saveError.message);
            onStatusChange('error');
          }
        }
      } catch (err) {
        console.error('Autosave exception:', err);
        onStatusChange('error');
      }
    },
    // draftType is stable; everything else is read from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftType, onStatusChange]
  );

  // Debounced auto-save: triggers whenever formData or activeStep changes
  useEffect(() => {
    if (!enabled || !staffId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDraft(true), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(formData), activeStep, enabled, staffId, workplanId]);

  const recoverDraft = useCallback(
    async (wpId: string | null, sId: string, period: string) => {
      try {
        const supabase = supabaseRef.current;
        let query = supabase
          .from('appraisal_drafts')
          .select('*')
          .eq('staff_id', sId)
          .eq('draft_type', draftType)
          .eq('review_period', period);

        if (wpId) {
          query = query.eq('workplan_id', wpId);
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
        let query = supabase
          .from('appraisal_drafts')
          .delete()
          .eq('staff_id', sId)
          .eq('draft_type', draftType)
          .eq('review_period', period);

        if (wpId) {
          query = query.eq('workplan_id', wpId);
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
    case 'error': return 'Save failed — will retry';
    default: return 'Auto-save on';
  }
}
