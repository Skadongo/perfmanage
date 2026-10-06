'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface OptimisticSubmitOptions<T> {
  /** The async server action to perform */
  action: () => Promise<void>;
  /** Optimistic state to apply immediately */
  optimisticUpdate?: () => void;
  /** Rollback function called if action fails */
  rollback?: () => void;
  /** Success toast message */
  successMessage?: string;
  /** Success toast description */
  successDescription?: string;
  /** Error toast message prefix */
  errorMessage?: string;
  /** Called after successful server confirmation */
  onSuccess?: () => void;
  /** Called after rollback */
  onError?: (err: Error) => void;
}

export interface OptimisticSubmitResult {
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  submit: () => Promise<void>;
  reset: () => void;
}

/**
 * useOptimisticSubmit — shows success UI immediately, rolls back only on failure.
 *
 * Pattern:
 *  1. Apply optimistic update instantly (UI feels instant)
 *  2. Show success toast immediately
 *  3. Fire server request in background
 *  4. If server fails → rollback state + show error toast
 */
export function useOptimisticSubmit<T = void>(
  options: OptimisticSubmitOptions<T>
): OptimisticSubmitResult {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const submit = useCallback(async () => {
    const {
      action,
      optimisticUpdate,
      rollback,
      successMessage = 'Saved successfully',
      successDescription,
      errorMessage = 'Action failed',
      onSuccess,
      onError,
    } = optionsRef.current;

    setSubmitting(true);
    setError(null);

    // 1. Apply optimistic update immediately
    optimisticUpdate?.();

    // 2. Show success toast immediately (optimistic)
    const toastId = toast.success(successMessage, {
      description: successDescription,
      duration: 4000,
    });

    // 3. Mark as submitted in UI right away
    setSubmitted(true);
    setSubmitting(false);

    // 4. Fire server request in background
    try {
      await action();
      onSuccess?.();
    } catch (err: any) {
      // 5. Rollback on failure
      rollback?.();
      setSubmitted(false);
      setError(err?.message ?? 'Unknown error');

      // Dismiss optimistic toast and show error
      toast.dismiss(toastId);
      toast.error(errorMessage, {
        description: err?.message ?? 'Please try again.',
        duration: 6000,
      });

      onError?.(err instanceof Error ? err : new Error(err?.message));
    }
  }, []);

  const reset = useCallback(() => {
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  }, []);

  return { submitting, submitted, error, submit, reset };
}

/**
 * useOptimisticList — manages a list with optimistic add/update/remove.
 * Rolls back the specific item if the server call fails.
 */
export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const previousRef = useRef<T[]>(initialItems);

  const optimisticAdd = useCallback((item: T) => {
    previousRef.current = items;
    setItems((prev) => [item, ...prev]);
  }, [items]);

  const optimisticUpdate = useCallback((id: string, patch: Partial<T>) => {
    previousRef.current = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, [items]);

  const optimisticRemove = useCallback((id: string) => {
    previousRef.current = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, [items]);

  const rollback = useCallback(() => {
    setItems(previousRef.current);
  }, []);

  const confirm = useCallback((items: T[]) => {
    setItems(items);
    previousRef.current = items;
  }, []);

  return { items, setItems, optimisticAdd, optimisticUpdate, optimisticRemove, rollback, confirm };
}
