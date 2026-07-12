'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// Stable singleton — avoids re-creating the client on every render/action
const supabase = createClient();

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

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Fetch unread count on mount (lightweight — count only)
  useEffect(() => {
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .then(({ count }) => {
        if (count != null) setUnreadCount(count);
      });

    // Subscribe to new notifications for badge count only
    const channel = supabase
      .channel('notifications-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setUnreadCount(c => c + 1);
          // If panel is open, prepend to list
          setNotifications(prev => {
            if (prev.length === 0 && !hasFetched.current) return prev;
            return [payload.new as Notification, ...prev].slice(0, 20);
          });
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
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
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
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
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
              <Icon name="EcsaNotifyIcon" size={16} className="text-primary" />
              <h3 className="text-sm font-700 text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-700 bg-destructive text-white rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 font-600 transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 font-600 transition-colors ${filter === 'unread' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Unread
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary font-600 hover:underline whitespace-nowrap"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && displayed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Icon name="EcsaNotifyIcon" size={28} className="opacity-20 mb-2" />
                <p className="text-xs">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
              </div>
            )}

            {!loading && displayed.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default;
              return (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 text-left transition-colors hover:bg-muted/40 ${!n.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-600 text-foreground leading-snug ${!n.is_read ? 'font-700' : ''}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
