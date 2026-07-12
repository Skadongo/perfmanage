'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// Stable singleton — avoids re-creating the client on every render
const supabase = createClient();

interface ActivityLog {
  id: string;
  activityType: string;
  actorName: string;
  actionDescription: string;
  subjectName: string | null;
  subjectDetail: string | null;
  iconName: string;
  iconBg: string;
  iconColor: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (fetchError) {
          setError('Could not load activity logs.');
          return;
        }

        const mapped: ActivityLog[] = (data || []).map((row) => ({
          id: row.id,
          activityType: row.activity_type,
          actorName: row.actor_name,
          actionDescription: row.action_description,
          subjectName: row.subject_name,
          subjectDetail: row.subject_detail,
          iconName: row.icon_name,
          iconBg: row.icon_bg,
          iconColor: row.icon_color,
          createdAt: row.created_at,
        }));

        setActivities(mapped);
      } catch {
        setError('Could not load activity logs.');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-700 text-foreground">Recent Activity</h3>
        <button className="text-[11px] text-primary font-600 hover:underline">View all</button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-4/5" />
                <div className="h-2 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {!loading && !error && activities.length === 0 && (
        <p className="text-xs text-muted-foreground">No recent activity found.</p>
      )}

      {!loading && !error && activities.length > 0 && (
        <div className="space-y-3">
          {activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-lg ${act.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon name={act.iconName as Parameters<typeof Icon>[0]['name']} size={14} className={act.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-snug">
                  <span className="font-600">{act.actorName}</span>{' '}
                  <span className="text-muted-foreground">{act.actionDescription}</span>
                  {act.subjectName && (
                    <>
                      {' '}
                      <span className="font-500 text-foreground">
                        {act.subjectName}
                        {act.subjectDetail ? ` — ${act.subjectDetail}` : ''}
                      </span>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(act.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}