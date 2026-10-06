'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';


interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'closed';
  reviewCycles: number;
  staffCovered: number;
}

const INITIAL_FISCAL_YEARS: FiscalYear[] = [
  { id: 'fy-2026', label: 'FY 2025/2026', startDate: '2025-07-01', endDate: '2026-06-30', status: 'active', reviewCycles: 2, staffCovered: 48 },
  { id: 'fy-2025', label: 'FY 2024/2025', startDate: '2024-07-01', endDate: '2025-06-30', status: 'closed', reviewCycles: 2, staffCovered: 45 },
  { id: 'fy-2027', label: 'FY 2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', status: 'upcoming', reviewCycles: 2, staffCovered: 0 },
];

interface FiscalYearFormData {
  label: string;
  startDate: string;
  endDate: string;
  reviewCycles: number;
}

const EMPTY_FORM: FiscalYearFormData = { label: '', startDate: '', endDate: '', reviewCycles: 2 };

export default function FiscalYearsTab() {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(INITIAL_FISCAL_YEARS);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FiscalYearFormData>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(fy: FiscalYear) {
    setEditId(fy.id);
    setForm({ label: fy.label, startDate: fy.startDate, endDate: fy.endDate, reviewCycles: fy.reviewCycles });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.label || !form.startDate || !form.endDate) return;
    if (editId) {
      setFiscalYears((prev) =>
        prev.map((fy) => (fy.id === editId ? { ...fy, ...form } : fy))
      );
    } else {
      const newFY: FiscalYear = {
        id: `fy-${Date.now()}`,
        ...form,
        status: 'upcoming',
        staffCovered: 0,
      };
      setFiscalYears((prev) => [...prev, newFY]);
    }
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id: string) {
    setFiscalYears((prev) => prev.filter((fy) => fy.id !== id));
    setConfirmDeleteId(null);
  }

  function setActive(id: string) {
    setFiscalYears((prev) =>
      prev.map((fy) => ({
        ...fy,
        status: fy.id === id ? 'active' : fy.status === 'active' ? 'closed' : fy.status,
      }))
    );
  }

  const statusColor: Record<FiscalYear['status'], string> = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    upcoming: 'bg-sky-100 text-sky-700 border-sky-200',
    closed: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-700 text-foreground">Fiscal Year Cycles</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fiscalYears.length} fiscal year{fiscalYears.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          Add Fiscal Year
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-700 text-foreground mb-4">
            {editId ? 'Edit Fiscal Year' : 'New Fiscal Year'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. FY 2026/2027"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Review Cycles</label>
              <select
                value={form.reviewCycles}
                onChange={(e) => setForm((f) => ({ ...f, reviewCycles: Number(e.target.value) }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value={1}>1 — Annual only</option>
                <option value={2}>2 — Mid-year + Annual</option>
                <option value={3}>3 — Quarterly</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!form.label || !form.startDate || !form.endDate}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editId ? 'Save Changes' : 'Create Fiscal Year'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 border border-border rounded-lg text-sm font-500 text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Label</th>
              <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Period</th>
              <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide hidden md:table-cell">Cycles</th>
              <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Staff</th>
              <th className="text-left px-5 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fiscalYears.map((fy) => (
              <tr key={fy.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5 font-600 text-foreground">{fy.label}</td>
                <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                  {fy.startDate} → {fy.endDate}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">{fy.reviewCycles}</td>
                <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell">{fy.staffCovered}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${statusColor[fy.status]}`}>
                    {fy.status.charAt(0).toUpperCase() + fy.status.slice(1)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 justify-end">
                    {fy.status !== 'active' && (
                      <button
                        onClick={() => setActive(fy.id)}
                        title="Set as active"
                        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <Icon name="CheckCircleIcon" size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(fy)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    {confirmDeleteId === fy.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(fy.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded font-600 hover:bg-red-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs border border-border rounded font-500 hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(fy.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Icon name="TrashIcon" size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
