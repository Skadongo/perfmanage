'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (profile && !profile.mustChangePassword) {
        router.replace('/performance-dashboard');
      }
    }
  }, [user, profile, loading, router]);

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Mark must_change_password as false in user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      setSuccess(true);
      setTimeout(() => {
        router.replace('/performance-dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthChecks = [
    { label: 'At least 8 characters', pass: newPassword.length >= 8 },
    { label: 'Uppercase letter (A–Z)', pass: /[A-Z]/.test(newPassword) },
    { label: 'Lowercase letter (a–z)', pass: /[a-z]/.test(newPassword) },
    { label: 'Number (0–9)', pass: /[0-9]/.test(newPassword) },
    { label: 'Special character (!@#$…)', pass: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const strengthScore = strengthChecks.filter((c) => c.pass).length;
  const strengthLabel = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][strengthScore];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500'][strengthScore];

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="h-1.5 bg-primary w-full" />

          <div className="p-8">
            {/* Logo + Title */}
            <div className="flex flex-col items-center mb-6">
              <Image
                src="/assets/images/ecsahc_web_logo1-1-1774467575072.png"
                alt="ECSA-HC Logo"
                width={64}
                height={64}
                className="object-contain mb-3"
              />
              <h1 className="text-lg font-700 text-foreground text-center">
                Set Your New Password
              </h1>
              <p className="text-sm text-muted-foreground mt-1 text-center leading-snug">
                Welcome! For security, you must set a personal password before continuing.
              </p>
            </div>

            {/* Info banner */}
            <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-blue-700">
                Signed in as <span className="font-600">{user.email}</span>. Your default password was <span className="font-600">Ecsahc@2026</span>. Please choose a strong personal password.
              </p>
            </div>

            {/* Success state */}
            {success ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-600 text-green-700">Password updated successfully!</p>
                <p className="text-xs text-muted-foreground">Redirecting to your dashboard…</p>
              </div>
            ) : (
              <>
                {/* Error */}
                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-600 text-foreground mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showNew ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {newPassword.length > 0 && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthColor : 'bg-muted'}`}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{strengthLabel}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-600 text-foreground mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirm ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                    )}
                    {confirmPassword.length > 0 && newPassword === confirmPassword && (
                      <p className="text-[11px] text-green-600 mt-1">Passwords match ✓</p>
                    )}
                  </div>

                  {/* Requirements checklist */}
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
                    <p className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide mb-2">Password Requirements</p>
                    {strengthChecks.map((check) => (
                      <div key={check.label} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${check.pass ? 'bg-green-500' : 'bg-muted border border-border'}`}>
                          {check.pass && (
                            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-[11px] ${check.pass ? 'text-green-700' : 'text-muted-foreground'}`}>{check.label}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || strengthScore < 5 || newPassword !== confirmPassword}
                    className="w-full py-2.5 px-4 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Updating Password…
                      </>
                    ) : (
                      'Set New Password & Continue'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="px-8 py-4 bg-muted/30 border-t border-border text-center">
            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} East, Central &amp; Southern Africa Health Community
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
