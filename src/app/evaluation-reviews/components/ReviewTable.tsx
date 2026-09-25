'use client';

import React, { useState, useEffect } from 'react';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import ReviewDetailModal from './ReviewDetailModal';
import EvaluationComparisonModal from './EvaluationComparisonModal';
import ApprovalModal, { ApprovalAction } from './ApprovalModal';
import { exportToCSV, exportToPDF, exportAppraisalPDF } from './ExportUtils';
import { createClient } from '@/lib/supabase/client';
import { mapStatus, computeProgress } from '@/lib/constants';

// ── Types ──────────────────────────────────────────────────────────────────────
type ReviewStatus = 'pending' | 'in-progress' | 'submitted' | 'approved' | 'overdue' | 'draft' | 'reviewed' | 'rejected';
type KpiStatus = 'achieved' | 'on-track' | 'at-risk' | 'overdue' | 'in-progress';

interface BscScore {
  perspective: string;
  selfScore: number;
  supervisorScore: number;
  weight: number;
}

interface KpiDetail {
  kpi: string;
  perspective: string;
  target: string;
  actual: string;
  selfRating: number;
  supervisorRating: number;
  status: KpiStatus;
}

interface Review {
  id: string;
  staffName: string;
  role: string;
  department: string;
  reviewType: string;
  status: ReviewStatus;
  dueDate: string;
  submittedDate: string;
  supervisor: string;
  selfScore: number;
  supervisorScore: number;
  overallProgress: number;
  bscScores: BscScore[];
  kpiDetails: KpiDetail[];
  comments: string;
}

export default function ReviewTable() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [comparisonReviewId, setComparisonReviewId] = useState<string | null>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [sortCol, setSortCol] = useState('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<Review | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('mid_year_reviews')
          .select(`
            id,
            review_status,
            review_year,
            review_period,
            self_rating,
            supervisor_rating,
            supervisor_comments,
            submitted_at,
            approved_at,
            created_at,
            staff:staff_id (
              id,
              full_name,
              job_title,
              supervisor_name,
              departments:department_id ( name )
            ),
            supervisor:supervisor_id (
              full_name
            ),
            timeline:timeline_id (
              submission_deadline,
              review_period,
              review_year
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const mapped: Review[] = (data ?? []).map((row: Record<string, unknown>) => {
          const staffRow = row.staff as Record<string, unknown> | null;
          const supervisorRow = row.supervisor as Record<string, unknown> | null;
          const timelineRow = row.timeline as Record<string, unknown> | null;
          const deptRow = staffRow?.departments as Record<string, unknown> | null;

          const selfRating = (row.self_rating as number) ?? 0;
          const supervisorRating = (row.supervisor_rating as number) ?? 0;
          const dbStatus = (row.review_status as string) ?? 'draft';
          const uiStatus = mapStatus(dbStatus);

          const reviewPeriod = (timelineRow?.review_period as string) ?? (row.review_period as string) ?? 'mid-year';
          const reviewYear = (timelineRow?.review_year as number) ?? (row.review_year as number) ?? new Date().getFullYear();
          const reviewType = reviewPeriod === 'annual' ? 'Annual Review' : 'Mid-Year Review';

          const deadlineRaw = timelineRow?.submission_deadline as string | null;
          const dueDate = deadlineRaw
            ? new Date(deadlineRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : `30 Jun ${reviewYear}`;

          const submittedRaw = (row.submitted_at as string) ?? (row.approved_at as string) ?? null;
          const submittedDate = submittedRaw
            ? new Date(submittedRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';

          const progress = computeProgress(uiStatus, selfRating, supervisorRating);

          return {
            id: row.id as string,
            staffName: (staffRow?.full_name as string) ?? 'Unknown Staff',
            role: (staffRow?.job_title as string) ?? '—',
            department: (deptRow?.name as string) ?? '—',
            reviewType,
            status: uiStatus,
            dueDate,
            submittedDate,
            supervisor: (supervisorRow?.full_name as string) ?? (staffRow?.supervisor_name as string) ?? '—',
            selfScore: selfRating,
            supervisorScore: supervisorRating,
            overallProgress: progress,
            bscScores: [],
            kpiDetails: [],
            comments: (row.supervisor_comments as string) ?? '',
          };
        });

        setReviews(mapped);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
        setError('Failed to load reviews. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchReviews();
  }, []);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = reviews.filter((r) => {
    const matchSearch = search === '' ||
      r.staffName.toLowerCase().includes(search.toLowerCase()) ||
      r.role.toLowerCase().includes(search.toLowerCase()) ||
      r.reviewType.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All Statuses' || r.status.replace('-', ' ') === statusFilter.toLowerCase() || r.status === statusFilter.toLowerCase().replace(' ', '-');
    const matchType = typeFilter === 'All Types' || r.reviewType === typeFilter;
    const matchRole = roleFilter === 'All Roles' || r.role === roleFilter;
    return matchSearch && matchStatus && matchType && matchRole;
  });

  const uniqueRoles = Array.from(new Set(reviews.map(r => r.role))).filter(Boolean).sort();

  const handleApprove = async (id: string) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('mid_year_reviews')
        .update({ review_status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as ReviewStatus, overallProgress: 100 } : r));
      toast.success('Review approved successfully', { description: 'Staff member will be notified.' });
    } catch {
      toast.error('Failed to approve review. Please try again.');
    }
  };

  function openApprovalModal(review: Review) {
    setApprovalTarget(review);
    setApprovalModalOpen(true);
  }

  function handleApprovalActionComplete(id: string, action: ApprovalAction) {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newStatus: ReviewStatus =
          action === 'approve' ? 'approved' :
          action === 'reject'? 'overdue' : 'in-progress';
        return {
          ...r,
          status: newStatus,
          overallProgress: computeProgress(newStatus, r.selfScore, r.supervisorScore),
        };
      })
    );
  }

  function openComparisonModal(reviewId: string) {
    setComparisonReviewId(reviewId);
    setComparisonModalOpen(true);
  }

  function handleComparisonActionComplete() {
    // Refresh the reviews list after approve/reject/save
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === comparisonReviewId) {
          return { ...r, status: r.status }; // trigger re-fetch via useEffect
        }
        return r;
      })
    );
    // Re-fetch reviews to get updated statuses
    const supabase = createClient();
    supabase
      .from('mid_year_reviews')
      .select(`
        id, review_status, self_rating, supervisor_rating, approved_at
      `)
      .eq('id', comparisonReviewId ?? '')
      .single()
      .then(({ data }) => {
        if (data) {
          setReviews((prev) =>
            prev.map((r) => {
              if (r.id === data.id) {
                const uiStatus = mapStatus(data.review_status);
                return {
                  ...r,
                  status: uiStatus,
                  selfScore: data.self_rating ?? r.selfScore,
                  supervisorScore: data.supervisor_rating ?? r.supervisorScore,
                  overallProgress: computeProgress(uiStatus, data.self_rating ?? 0, data.supervisor_rating ?? 0),
                };
              }
              return r;
            })
          );
        }
      });
  }

  const handleBulkRemind = () => {
    toast.info(`Reminders sent to ${selectedIds.length} staff members`);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(r => r.id));
  };

  const handleExportCSV = () => {
    setExporting('csv');
    try {
      const submittedReviews = filtered.filter(r => r.status === 'submitted' || r.status === 'approved');
      if (submittedReviews.length === 0) {
        toast.warning('No submitted or approved reviews to export');
        return;
      }
      exportToCSV(submittedReviews.map(r => ({
        id: r.id,
        staffName: r.staffName,
        role: r.role,
        reviewType: r.reviewType,
        status: r.status,
        dueDate: r.dueDate,
        submittedDate: r.submittedDate,
        supervisor: r.supervisor,
        selfScore: r.selfScore,
        supervisorScore: r.supervisorScore,
        overallProgress: r.overallProgress,
        comments: r.comments,
      })));
      toast.success(`CSV exported — ${submittedReviews.length} reviews`, { description: 'File downloaded to your device.' });
    } catch {
      toast.error('CSV export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const submittedReviews = filtered.filter(r => r.status === 'submitted' || r.status === 'approved');
      if (submittedReviews.length === 0) {
        toast.warning('No submitted or approved reviews to export');
        return;
      }
      await exportToPDF(submittedReviews.map(r => ({
        id: r.id,
        staffName: r.staffName,
        role: r.role,
        reviewType: r.reviewType,
        status: r.status,
        dueDate: r.dueDate,
        submittedDate: r.submittedDate,
        supervisor: r.supervisor,
        selfScore: r.selfScore,
        supervisorScore: r.supervisorScore,
        overallProgress: r.overallProgress,
        comments: r.comments,
      })));
      toast.success(`PDF exported — ${submittedReviews.length} reviews`, { description: 'File downloaded to your device.' });
    } catch {
      toast.error('PDF export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportRowPDF = async (review: Review) => {
    setExportingRowId(review.id);
    try {
      await exportAppraisalPDF({
        staffName: review.staffName,
        role: review.role,
        department: review.department,
        supervisor: review.supervisor,
        reviewType: review.reviewType,
        status: review.status,
        dueDate: review.dueDate,
        submittedDate: review.submittedDate,
        selfScore: review.selfScore,
        supervisorScore: review.supervisorScore,
        overallProgress: review.overallProgress,
        bscScores: review.bscScores,
        kpiDetails: review.kpiDetails,
        comments: review.comments,
      });
      toast.success(`Appraisal PDF downloaded — ${review.staffName}`);
    } catch {
      toast.error('PDF export failed. Please try again.');
    } finally {
      setExportingRowId(null);
    }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <Icon
      name={sortCol === col ? (sortDir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon') : 'ChevronUpDownIcon'}
      size={12}
      className={sortCol === col ? 'text-primary' : 'text-muted-foreground'}
    />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-border shadow-card">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={28} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-red-200 shadow-card">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ExclamationTriangleIcon" size={28} className="text-red-500" />
          <p className="text-sm font-600 text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Filters + Export row */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search staff, role, or review type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
          {['All Types', 'Mid-Year Review', 'Annual Review'].map(o => <option key={`type-${o}`} value={o}>{o}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
          {['All Statuses', 'Pending', 'In Progress', 'Submitted', 'Approved', 'Overdue'].map(o => <option key={`status-${o}`} value={o}>{o}</option>)}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="All Roles">All Roles</option>
          {uniqueRoles.map(r => <option key={`role-${r}`} value={r}>{r}</option>)}
        </select>

        {/* Export buttons */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={handleExportCSV}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            title="Export submitted & approved reviews to CSV"
          >
            {exporting === 'csv' ? (
              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
            ) : (
              <Icon name="TableCellsIcon" size={13} />
            )}
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-600 text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            title="Export submitted & approved reviews to PDF"
          >
            {exporting === 'pdf' ? (
              <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
            ) : (
              <Icon name="DocumentArrowDownIcon" size={13} />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-3 animate-slide-up">
          <span className="text-sm font-600 text-primary">{selectedIds.length} selected</span>
          <button onClick={handleBulkRemind} className="text-sm font-600 text-white bg-primary px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Icon name="BellIcon" size={14} />
            Send Reminder
          </button>
          <button onClick={() => setSelectedIds([])} className="text-sm text-muted-foreground hover:text-foreground ml-auto">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border accent-primary"
                    aria-label="Select all"
                  />
                </th>
                {[
                  { label: 'Staff Member', col: 'staffName' },
                  { label: 'Role', col: 'role' },
                  { label: 'Review Type', col: 'reviewType' },
                  { label: 'Self Score', col: 'selfScore' },
                  { label: 'Sup. Score', col: 'supervisorScore' },
                  { label: 'Progress', col: 'overallProgress' },
                  { label: 'Status', col: 'status' },
                  { label: 'Due Date', col: 'dueDate' },
                  { label: 'Supervisor', col: 'supervisor' },
                ].map(({ label, col }) => (
                  <th
                    key={`th-${col}`}
                    className="text-left px-4 py-3 text-[11px] font-600 uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort(col)}
                  >
                    <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
                  </th>
                ))}
                <th className="px-4 py-3 w-16 text-[11px] font-600 uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="ClipboardDocumentCheckIcon" size={32} className="text-muted-foreground" />
                      <p className="text-sm font-600 text-foreground">No reviews match your filters</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((review, idx) => (
                  <tr
                    key={review.id}
                    className={`border-b border-border last:border-0 transition-colors group ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'
                    } hover:bg-muted/40`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(review.id)}
                        onChange={() => toggleSelect(review.id)}
                        className="rounded border-border accent-primary"
                        aria-label={`Select ${review.staffName}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-[10px] font-700">
                            {review.staffName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="font-600 text-foreground whitespace-nowrap">{review.staffName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{review.role}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-600 px-2 py-0.5 rounded-full ${
                        review.reviewType === 'Mid-Year Review' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-violet-50 text-violet-700 border border-violet-200'
                      }`}>{review.reviewType}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-700 tabular-nums font-mono ${review.selfScore > 0 ? 'text-sky-700' : 'text-muted-foreground'}`}>
                        {review.selfScore > 0 ? review.selfScore.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-700 tabular-nums font-mono ${review.supervisorScore > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {review.supervisorScore > 0 ? review.supervisorScore.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <ProgressBar
                        value={review.overallProgress}
                        colorClass={review.status === 'approved' ? 'bg-emerald-500' : review.status === 'overdue' ? 'bg-red-400' : 'bg-primary'}
                        height="h-1.5"
                        showLabel
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={review.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className={review.status === 'overdue' ? 'text-red-600 font-600' : ''}>{review.dueDate}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{review.supervisor}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setSelectedReview(review); setModalOpen(true); }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View review details"
                          aria-label="View review details"
                        >
                          <Icon name="EyeIcon" size={14} />
                        </button>
                        {/* Comparison view button — shown for submitted/reviewed/approved */}
                        {(review.status === 'submitted' || review.status === 'in-progress' || review.status === 'approved') && (
                          <button
                            onClick={() => openComparisonModal(review.id)}
                            className="p-1.5 rounded-md hover:bg-violet-50 text-muted-foreground hover:text-violet-600 transition-colors"
                            title="Side-by-side comparison view"
                            aria-label="Open comparison view"
                          >
                            <Icon name="ScaleIcon" size={14} />
                          </button>
                        )}
                        {(review.status === 'approved' || review.status === 'submitted') && (
                          <button
                            onClick={() => handleExportRowPDF(review)}
                            disabled={exportingRowId === review.id}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors disabled:opacity-60"
                            title="Export appraisal as PDF"
                            aria-label="Export appraisal PDF"
                          >
                            {exportingRowId === review.id ? (
                              <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                            ) : (
                              <Icon name="DocumentArrowDownIcon" size={14} />
                            )}
                          </button>
                        )}
                        {review.status === 'submitted' && (
                          <button
                            onClick={() => openApprovalModal(review)}
                            className="p-1.5 rounded-md hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                            title="Open approval decision"
                            aria-label="Open approval decision"
                          >
                            <Icon name="ClipboardDocumentCheckIcon" size={14} />
                          </button>
                        )}
                        {(review.status === 'pending' || review.status === 'in-progress') && (
                          <button
                            onClick={() => toast.info(`Reminder sent to ${review.staffName}`)}
                            className="p-1.5 rounded-md hover:bg-amber-50 text-muted-foreground hover:text-amber-600 transition-colors"
                            title="Send reminder"
                            aria-label="Send reminder"
                          >
                            <Icon name="BellIcon" size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
          <p className="text-xs text-muted-foreground">Showing <span className="font-600">{filtered.length}</span> of <span className="font-600">{reviews.length}</span> reviews</p>
          <div className="flex items-center gap-1">
            {[1].map((p) => (
              <button key={`page-${p}`} className="w-7 h-7 text-xs font-600 rounded-md bg-primary text-white">
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ReviewDetailModal
        review={selectedReview}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onApprove={(id) => {
          const target = reviews.find((r) => r.id === id) ?? null;
          if (target) {
            setModalOpen(false);
            openApprovalModal(target);
          }
        }}
      />

      {comparisonReviewId && (
        <EvaluationComparisonModal
          reviewId={comparisonReviewId}
          open={comparisonModalOpen}
          onClose={() => { setComparisonModalOpen(false); setComparisonReviewId(null); }}
          onActionComplete={handleComparisonActionComplete}
        />
      )}

      <ApprovalModal
        open={approvalModalOpen}
        onClose={() => { setApprovalModalOpen(false); setApprovalTarget(null); }}
        review={approvalTarget}
        onActionComplete={handleApprovalActionComplete}
      />
    </>
  );
}