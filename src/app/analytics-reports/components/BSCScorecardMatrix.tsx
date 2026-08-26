'use client';

import React, { useEffect, useState } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { createClient } from '@/lib/supabase/client';

interface ScorecardRow {
  role: string;
  finance: { score: number };
  customer: { score: number };
  process: { score: number };
  capacity: { score: number };
  overall: number;
  reviewCount: number;
}

const CELL_COLOR = (score: number) => {
  if (score >= 100) return 'bg-emerald-100 text-emerald-800';
  if (score >= 75)  return 'bg-sky-50 text-sky-800';
  if (score >= 50)  return 'bg-amber-50 text-amber-800';
  return 'bg-red-50 text-red-800';
};

// Map system_role enum to display label
const ROLE_LABELS: Record<string, string> = {
  executive_director: 'Executive Director',
  deputy_director: 'Deputy Director',
  programme_manager: 'Programme Manager',
  finance_manager: 'Finance Manager',
  hr_admin_officer: 'HR & Admin Officer',
  programme_officer: 'Programme Officer',
  finance_officer: 'Finance Officer',
  admin_officer: 'Admin Officer',
  project_coordinator: 'Project Coordinator',
};

// BSC perspective weights derived from review data
// Finance/Stewardship → supervisor_rating weighted
// Customer/Ops → avg of supervisor + self
// Business Process → self_rating weighted
// Org Capacity → avg of both with bonus for approved status
function computeBSCScores(reviews: Array<{ supervisor_rating: number | null; self_rating: number | null; review_status: string }>) {
  if (reviews.length === 0) return { finance: 0, customer: 0, process: 0, capacity: 0 };

  const supRatings = reviews.filter(r => r.supervisor_rating != null && r.supervisor_rating > 0).map(r => r.supervisor_rating as number);
  const selfRatings = reviews.filter(r => r.self_rating != null && r.self_rating > 0).map(r => r.self_rating as number);
  const approvedCount = reviews.filter(r => r.review_status === 'approved').length;
  const submittedCount = reviews.filter(r => ['submitted', 'reviewed', 'approved'].includes(r.review_status)).length;

  // Average ratings on 1–5 scale, then scale to 0–100 by × 20
  const avgSup100 = supRatings.length > 0 ? (supRatings.reduce((a, b) => a + b, 0) / supRatings.length) * 20 : 0;
  const avgSelf100 = selfRatings.length > 0 ? (selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length) * 20 : 0;
  const submissionRate100 = reviews.length > 0 ? (submittedCount / reviews.length) * 100 : 0;
  const approvalRate100 = reviews.length > 0 ? (approvedCount / reviews.length) * 100 : 0;

  // All perspectives on 0–100 scale
  // Finance/Stewardship: supervisor rating is primary indicator
  const finance = Math.min(100, Math.round(avgSup100));
  // Customer/Stakeholder: average of supervisor and self ratings
  const customer = Math.min(100, Math.round((avgSup100 + avgSelf100) / 2));
  // Internal Business Processes: 50% submission rate + 50% self rating
  const process = Math.min(100, Math.round(submissionRate100 * 0.5 + avgSelf100 * 0.5));
  // Innovation/Capacity: 40% approval rate + 60% supervisor rating
  const capacity = Math.min(100, Math.round(approvalRate100 * 0.4 + avgSup100 * 0.6));

  return { finance, customer, process, capacity };
}

export default function BSCScorecardMatrix() {
  const [data, setData] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();

        const { data: reviews, error: err } = await supabase
          .from('mid_year_reviews')
          .select(`
            supervisor_rating,
            self_rating,
            review_status,
            staff:staff_id (
              system_role,
              job_title
            )
          `);

        if (err) throw err;

        if (!reviews || reviews.length === 0) {
          setData([]);
          return;
        }

        // Group reviews by role
        const byRole: Record<string, Array<{ supervisor_rating: number | null; self_rating: number | null; review_status: string }>> = {};

        reviews.forEach((r: { supervisor_rating: number | null; self_rating: number | null; review_status: string; staff: { system_role: string | null; job_title: string } | null }) => {
          const roleKey = r.staff?.system_role || 'unknown';
          if (!byRole[roleKey]) byRole[roleKey] = [];
          byRole[roleKey].push({
            supervisor_rating: r.supervisor_rating,
            self_rating: r.self_rating,
            review_status: r.review_status,
          });
        });

        const rows: ScorecardRow[] = Object.entries(byRole)
          .filter(([role]) => role !== 'unknown')
          .map(([role, roleReviews]) => {
            const scores = computeBSCScores(roleReviews);
            // Weighted overall using ECSA-HC BSC framework weights: Finance 30%, Customer 30%, Process 25%, Capacity 15%
            // BSC overall is on 0–100 scale (normalised to 100%)
            const overall = Math.round(
              (scores.finance * 0.30 + scores.customer * 0.30 + scores.process * 0.25 + scores.capacity * 0.15) * 10
            ) / 10;
            return {
              role: ROLE_LABELS[role] || role,
              finance: { score: scores.finance },
              customer: { score: scores.customer },
              process: { score: scores.process },
              capacity: { score: scores.capacity },
              overall,
              reviewCount: roleReviews.length,
            };
          })
          .sort((a, b) => b.overall - a.overall);

        setData(rows);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load scorecard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const orgAvg = (key: keyof Pick<ScorecardRow, 'finance' | 'customer' | 'process' | 'capacity'>) =>
    data.length > 0 ? data.reduce((a, r) => a + r[key].score, 0) / data.length : 0;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">BSC Scorecard Matrix — All Roles</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Derived from mid-year review ratings · BSC Score by Perspective (0–100%) · Total max 120% with competencies</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" />≥100 Outstanding / Above Average</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-50 inline-block" />75–99 Needs Improvement</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-50 inline-block" />50–74 Below Threshold</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 inline-block" />&lt;50 Unsatisfactory</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-40 text-xs text-red-600 p-4">{error}</div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">No review data available</div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Role</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Finance / Stewardship</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Customer / Ops</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Business Process</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Org. Capacity</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Overall</th>
                <th className="text-center px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={`sc-row-${row.role}`}
                  className={`border-b border-border last:border-0 transition-colors ${
                    hoveredRole === row.role ? 'bg-muted/30' : idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'
                  }`}
                  onMouseEnter={() => setHoveredRole(row.role)}
                  onMouseLeave={() => setHoveredRole(null)}
                >
                  <td className="px-4 py-3 font-600 text-foreground whitespace-nowrap">{row.role}</td>
                  {[row.finance, row.customer, row.process, row.capacity].map((cell, ci) => (
                    <td key={`sc-cell-${row.role}-${ci}`} className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-sm font-700 tabular-nums font-mono ${CELL_COLOR(cell.score)}`}>
                        {cell.score}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      <ProgressBar
                        value={row.overall}
                        colorClass={row.overall >= 85 ? 'bg-emerald-500' : row.overall >= 70 ? 'bg-primary' : 'bg-amber-400'}
                        height="h-1.5"
                        className="w-16"
                      />
                      <span className={`text-sm font-700 tabular-nums font-mono ${CELL_COLOR(row.overall)}`}>
                        {row.overall.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground tabular-nums">{row.reviewCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-4 py-3 text-xs font-700 text-foreground">Org. Average</td>
                {(['finance', 'customer', 'process', 'capacity'] as const).map((key, ai) => (
                  <td key={`avg-cell-${ai}`} className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-sm font-700 tabular-nums font-mono ${CELL_COLOR(orgAvg(key))}`}>
                      {orgAvg(key).toFixed(1)}
                    </span>
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-700 tabular-nums font-mono text-primary">
                    {data.length > 0
                      ? (Math.round(
                          (data.reduce((a, r) => a + r.overall, 0) / data.length) * 10
                        ) / 10).toFixed(1)
                      : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground tabular-nums">
                  {data.reduce((a, r) => a + r.reviewCount, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}