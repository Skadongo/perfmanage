/**
 * Shared form utilities for evaluation forms.
 * Extracts the common patterns from EvaluationForm, SelfEvaluationForm,
 * SupervisorReviewForm, and WorkplanSettingForm:
 * - useFormState hook (loading/saving/error state management)
 * - FormField component (label + input wrapper)
 * - FormErrorDisplay component (error message display)
 * - FormSectionNav component (multi-step section navigation)
 */

'use client';

import React, { useState, useCallback } from 'react';

// ─── useFormState hook ────────────────────────────────────────────────────────

interface FormStateOptions {
  initialSaving?: boolean;
}

export interface FormState {
  saving: boolean;
  setSaving: (v: boolean) => void;
  formError: string | null;
  setFormError: (msg: string | null) => void;
  clearError: () => void;
}

/**
 * Shared loading/saving/error state for all evaluation forms.
 */
export function useFormState(opts: FormStateOptions = {}): FormState {
  const [saving, setSaving] = useState(opts.initialSaving ?? false);
  const [formError, setFormError] = useState<string | null>(null);
  const clearError = useCallback(() => setFormError(null), []);
  return { saving, setSaving, formError, setFormError, clearError };
}

// ─── FormField component ──────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

/**
 * Shared label + input wrapper used across all evaluation forms.
 */
export function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-600 text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── FormErrorDisplay component ───────────────────────────────────────────────

interface FormErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
}

/**
 * Shared error banner used at the top of evaluation forms.
 */
export function FormErrorDisplay({ error, onDismiss }: FormErrorDisplayProps) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
      <span className="flex-1">{error}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── FormSectionNav component ─────────────────────────────────────────────────

interface FormSectionNavProps {
  sections: { id: string; label: string }[];
  activeSection: string;
  onSelect: (id: string) => void;
  completedSections?: string[];
}

/**
 * Shared multi-step section navigation used in WorkplanSettingForm and EvaluationForm.
 */
export function FormSectionNav({ sections, activeSection, onSelect, completedSections = [] }: FormSectionNavProps) {
  return (
    <nav className="flex gap-1 flex-wrap">
      {sections.map((s) => {
        const isActive = s.id === activeSection;
        const isDone = completedSections.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : isDone
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Shared CSS class strings ─────────────────────────────────────────────────

export const inputCls =
  'w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/60';

export const textareaCls = inputCls + ' resize-none';

// ─── Shared rating labels ─────────────────────────────────────────────────────

export const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: 'Outstanding', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  4: { label: 'Exceeds Expectations', color: 'bg-sky-100 text-sky-700 border-sky-300' },
  3: { label: 'Meets Expectations', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  2: { label: 'Needs Improvement', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  1: { label: 'Unsatisfactory', color: 'bg-red-100 text-red-700 border-red-300' },
};
