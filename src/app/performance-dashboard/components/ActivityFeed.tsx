'use client';

import React, { useEffect, useState, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

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

interface Props {
  /** When set, only shows activity for this staff member (self view) */
  staffId?: string | null;
  /** When set, only shows activity for direct reports of this supervisor */
  supervisorId?: string | null;
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

export default function ActivityFeed({ staffId, supervisorId }: Props) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stable client ref — never recreated across renders
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const supabase = supabaseRef.current;

        let query = supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        // Scope by staff member (self view)
        if (staffId) {
          query = query.eq('subject_id', staffId);
        }
        // Scope by supervisor — filter by actor_id matching supervisor's staff id
        // so supervisors see actions taken by or about their direct reports
        if (supervisorId && !staffId) {
          query = query.eq('supervisor_id', supervisorId);
        }

        const { data, error: fetchError } = await query;

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
  }, [staffId, supervisorId]);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-foreground">
            {staffId ? 'My Activity' : supervisorId ? 'Team Activity' : 'Recent Activity'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staffId ? 'Your recent actions' : supervisorId ? 'Your direct reports' : 'Organisation-wide'}
          </p>
        </div>
        <Icon name="BellIcon" size={16} className="text-muted-foreground" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center py-8 text-red-500 text-sm gap-2">
          <Icon name="ExclamationTriangleIcon" size={14} className="text-red-500" />
          {error}
        </div>
      )}

      {!loading && !error && activities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <Icon name="ClockIcon" size={20} className="text-muted-foreground/50" />
          No recent activity
        </div>
      )}

      {!loading && !error && activities.length > 0 && (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full ${activity.iconBg || 'bg-muted'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon
                  name={(activity.iconName as Parameters<typeof Icon>[0]['name']) || 'BellIcon'}
                  size={14}
                  className={activity.iconColor || 'text-muted-foreground'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-600 text-foreground truncate">{activity.actorName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{activity.actionDescription}</p>
                {activity.subjectName && (
                  <p className="text-[10px] text-muted-foreground/70 truncate">{activity.subjectName}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                {timeAgo(activity.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}