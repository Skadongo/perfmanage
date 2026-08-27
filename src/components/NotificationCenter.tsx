'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  form_submitted: { icon: 'ClipboardDocumentCheckIcon', color: 'text-sky-600', bg: 'bg-sky-50' },
  review_deadline: { icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
  supervisor_assigned: { icon: 'UserPlusIcon', color: 'text-violet-600', bg: 'bg-violet-50' },
  audit_change: { icon: 'ShieldCheckIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  appraisal_submitted: { icon: 'CheckBadgeIcon', color: 'text-primary', bg: 'bg-primary/10' },
  appraisal_approved: { icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  appraisal_rejected: { icon: 'XCircleIcon', color: 'text-red-600', bg: 'bg-red-50' },
  default: { icon: 'BellIcon', color: 'text-muted-foreground', bg: 'bg-muted' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Client-only time display to avoid SSR/client hydration mismatch
function TimeAgo({ dateStr }: { dateStr: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(timeAgo(dateStr));
  }, [dateStr]);
  return <>{label}</>;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);
  // Stable supabase client — never recreated
  const supabaseRef = useRef(createClient());
  // Current user's staff_id — resolved once on mount
  const staffIdRef = useRef<string | null>(null);

  // Resolve current user's staff_id on mount
  useEffect(() => {
    const supabase = supabaseRef.current;

    async function resolveStaffId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('staff_id')
        .eq('id', user.id)
        .maybeSingle();

      staffIdRef.current = profile?.staff_id ?? null;

      // Fetch unread count once staff_id is known
      if (staffIdRef.current) {
        let query = supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('recipient_staff_id', staffIdRef.current);

        const { count } = await query;
        if (count != null) setUnreadCount(count);
      } else {
        // Fallback: HR/Director — fetch all unread
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false);
        if (count != null) setUnreadCount(count);
      }
    }

    resolveStaffId();

    // Subscribe to new notifications for badge count only
    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification & { recipient_staff_id?: string };
          // Only increment badge if this notification is for the current user
          if (!staffIdRef.current || newNotif.recipient_staff_id === staffIdRef.current) {
            setUnreadCount(c => c + 1);
            setNotifications(prev => {
              if (prev.length === 0 && !hasFetched.current) return prev;
              return [payload.new as Notification, ...prev].slice(0, 20);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Lazy-load full notification list only when panel is first opened
  const fetchNotifications = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    try {
      const supabase = supabaseRef.current;
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Scope to current user's staff_id if available
      if (staffIdRef.current) {
        query = query.eq('recipient_staff_id', staffIdRef.current);
      }

      const { data } = await query;
      setNotifications(data || []);
      const unread = (data || []).filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(v => {
      if (!v) fetchNotifications();
      return !v;
    });
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayed = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  async function markAllRead() {
    const supabase = supabaseRef.current;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    const supabase = supabaseRef.current;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
        aria-label="Notifications"
      >
        <Icon name="EcsaNotifyIcon" size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-destructive rounded-full flex items-center justify-center text-[9px] font-700 text-white px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-border z-50 flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-700 text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-700 bg-destructive text-white px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary font-600 hover:underline">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-border">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-600 rounded-lg capitalize transition-colors ${
                  filter === f ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f} {f === 'unread' && unreadCount > 0 ? `(${unreadCount})` : ''}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-xs text-muted-foreground">Loading…</span>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Icon name="BellIcon" size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-600 text-foreground">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filter === 'unread' ? 'No unread notifications' : 'Alerts will appear here in real-time'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayed.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.default;
                  return (
                    <button
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors ${!n.is_read ? 'bg-primary/3' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={15} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-700 text-foreground leading-snug ${!n.is_read ? 'text-primary' : ''}`}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          <TimeAgo dateStr={n.created_at} />
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-center">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Real-time updates active
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
