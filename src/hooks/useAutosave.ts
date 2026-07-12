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
  // Stable client — never recreated across renders
  const supabaseRef = useRef(createClient());

  const saveDraft = useCallback(
    async (silent = false) => {
      if (!enabled || !staffId) return;
      if (!silent) onStatusChange('saving');
      try {
        const supabase = supabaseRef.current;
        const payload = {
          staff_id: staffId,
          workplan_id: workplanId ?? null,
          draft_type: draftType,
          review_period: reviewPeriod,
          form_data: formData,
          active_step: activeStep,
          last_saved_at: new Date().toISOString(),
        };

        // Manual upsert: find existing draft then insert or update.
        // This avoids the PostgREST onConflict column-string limitation which
        // cannot resolve partial/functional indexes and throws:
        // "there is no unique or exclusion constraint matching the ON CONFLICT specification"
        let existingId: string | null = null;
        {
          let q = supabase
            .from('appraisal_drafts')
            .select('id')
            .eq('staff_id', staffId)
            .eq('draft_type', draftType)
            .eq('review_period', reviewPeriod);

          if (workplanId) {
            q = q.eq('workplan_id', workplanId);
          } else {
            q = q.is('workplan_id', null);
          }

          const { data } = await q.maybeSingle();
          existingId = data?.id ?? null;
        }

        let error: { message: string } | null = null;

        if (existingId) {
          const { error: updateError } = await supabase
            .from('appraisal_drafts')
            .update({
              form_data: payload.form_data,
              active_step: payload.active_step,
              last_saved_at: payload.last_saved_at,
            })
            .eq('id', existingId);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from('appraisal_drafts')
            .insert(payload);
          error = insertError;
        }

        if (!error) {
          onStatusChange('saved');
          setTimeout(() => onStatusChange('idle'), 3000);
        } else {
          console.error('Autosave error:', error.message);
          onStatusChange('error');
        }
      } catch (err) {
        console.error('Autosave exception:', err);
        onStatusChange('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, staffId, workplanId, draftType, reviewPeriod, activeStep, JSON.stringify(formData)]
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
    case 'error': return 'Save failed';
    default: return 'Auto-save on';
  }
}
