'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface WorkflowStage {
  id: string;
  order: number;
  name: string;
  assignedRole: string;
  action: string;
  durationDays: number;
  required: boolean;
}

interface EvaluationWorkflow {
  id: string;
  name: string;
  type: 'annual' | 'mid-year' | 'probation' | 'custom';
  description: string;
  active: boolean;
  stages: WorkflowStage[];
}

const ROLE_OPTIONS = [
  'staff_member', 'programme_officer', 'finance_officer', 'admin_officer',
  'programme_manager', 'finance_manager', 'hr_admin_officer', 'deputy_director', 'executive_director',
];

const ACTION_OPTIONS = ['Submit', 'Review', 'Approve', 'Reject', 'Acknowledge', 'Sign Off'];

const TYPE_COLORS: Record<EvaluationWorkflow['type'], string> = {
  annual: 'bg-violet-100 text-violet-700 border-violet-200',
  'mid-year': 'bg-sky-100 text-sky-700 border-sky-200',
  probation: 'bg-amber-100 text-amber-700 border-amber-200',
  custom: 'bg-gray-100 text-gray-600 border-gray-200',
};

const INITIAL_WORKFLOWS: EvaluationWorkflow[] = [
  {
    id: 'wf1',
    name: 'Annual Performance Appraisal',
    type: 'annual',
    description: 'Full-year appraisal cycle covering self-assessment, supervisor review, and final approval.',
    active: true,
    stages: [
      { id: 's1', order: 1, name: 'Self-Assessment', assignedRole: 'staff_member', action: 'Submit', durationDays: 14, required: true },
      { id: 's2', order: 2, name: 'Supervisor Review', assignedRole: 'programme_manager', action: 'Review', durationDays: 7, required: true },
      { id: 's3', order: 3, name: 'HR Validation', assignedRole: 'hr_admin_officer', action: 'Approve', durationDays: 5, required: true },
      { id: 's4', order: 4, name: 'Director Sign-Off', assignedRole: 'deputy_director', action: 'Sign Off', durationDays: 3, required: false },
    ],
  },
  {
    id: 'wf2',
    name: 'Mid-Year Review',
    type: 'mid-year',
    description: 'Interim review to track progress against annual workplan targets.',
    active: true,
    stages: [
      { id: 's5', order: 1, name: 'Progress Self-Report', assignedRole: 'staff_member', action: 'Submit', durationDays: 7, required: true },
      { id: 's6', order: 2, name: 'Supervisor Feedback', assignedRole: 'programme_manager', action: 'Review', durationDays: 5, required: true },
      { id: 's7', order: 3, name: 'HR Acknowledgement', assignedRole: 'hr_admin_officer', action: 'Acknowledge', durationDays: 3, required: true },
    ],
  },
  {
    id: 'wf3',
    name: 'Probation Assessment',
    type: 'probation',
    description: 'End-of-probation evaluation for new staff members.',
    active: false,
    stages: [
      { id: 's8', order: 1, name: 'Probationer Self-Assessment', assignedRole: 'staff_member', action: 'Submit', durationDays: 5, required: true },
      { id: 's9', order: 2, name: 'Line Manager Review', assignedRole: 'programme_manager', action: 'Approve', durationDays: 5, required: true },
      { id: 's10', order: 3, name: 'HR Decision', assignedRole: 'hr_admin_officer', action: 'Approve', durationDays: 3, required: true },
    ],
  },
];

export default function EvaluationWorkflowsTab() {
  const [workflows, setWorkflows] = useState<EvaluationWorkflow[]>(INITIAL_WORKFLOWS);
  const [expandedId, setExpandedId] = useState<string | null>('wf1');
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowType, setNewWorkflowType] = useState<EvaluationWorkflow['type']>('custom');
  const [newWorkflowDesc, setNewWorkflowDesc] = useState('');
  const [editingStage, setEditingStage] = useState<{ workflowId: string; stageId: string | null } | null>(null);
  const [stageForm, setStageForm] = useState<Omit<WorkflowStage, 'id' | 'order'>>({
    name: '', assignedRole: 'staff_member', action: 'Submit', durationDays: 7, required: true,
  });

  function toggleActive(id: string) {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w)));
  }

  function addWorkflow() {
    if (!newWorkflowName) return;
    setWorkflows((prev) => [...prev, {
      id: `wf-${Date.now()}`,
      name: newWorkflowName,
      type: newWorkflowType,
      description: newWorkflowDesc,
      active: false,
      stages: [],
    }]);
    setShowNewWorkflow(false);
    setNewWorkflowName('');
    setNewWorkflowDesc('');
  }

  function openAddStage(workflowId: string) {
    setEditingStage({ workflowId, stageId: null });
    setStageForm({ name: '', assignedRole: 'staff_member', action: 'Submit', durationDays: 7, required: true });
  }

  function openEditStage(workflowId: string, stage: WorkflowStage) {
    setEditingStage({ workflowId, stageId: stage.id });
    setStageForm({ name: stage.name, assignedRole: stage.assignedRole, action: stage.action, durationDays: stage.durationDays, required: stage.required });
  }

  function saveStage() {
    if (!editingStage || !stageForm.name) return;
    const { workflowId, stageId } = editingStage;
    setWorkflows((prev) => prev.map((w) => {
      if (w.id !== workflowId) return w;
      if (stageId) {
        return { ...w, stages: w.stages.map((s) => (s.id === stageId ? { ...s, ...stageForm } : s)) };
      } else {
        const newStage: WorkflowStage = { id: `s-${Date.now()}`, order: w.stages.length + 1, ...stageForm };
        return { ...w, stages: [...w.stages, newStage] };
      }
    }));
    setEditingStage(null);
  }

  function deleteStage(workflowId: string, stageId: string) {
    setWorkflows((prev) => prev.map((w) => {
      if (w.id !== workflowId) return w;
      const updated = w.stages.filter((s) => s.id !== stageId).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...w, stages: updated };
    }));
  }

  function moveStage(workflowId: string, stageId: string, direction: 'up' | 'down') {
    setWorkflows((prev) => prev.map((w) => {
      if (w.id !== workflowId) return w;
      const idx = w.stages.findIndex((s) => s.id === stageId);
      if (idx < 0) return w;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= w.stages.length) return w;
      const stages = [...w.stages];
      [stages[idx], stages[newIdx]] = [stages[newIdx], stages[idx]];
      return { ...w, stages: stages.map((s, i) => ({ ...s, order: i + 1 })) };
    }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-700 text-foreground">Evaluation Workflows</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {workflows.filter((w) => w.active).length} active workflow{workflows.filter((w) => w.active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewWorkflow(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          New Workflow
        </button>
      </div>

      {/* New workflow form */}
      {showNewWorkflow && (
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-700 text-foreground mb-4">Create Workflow</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1">Workflow Name</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="e.g. Contract Staff Review"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Type</label>
              <select
                value={newWorkflowType}
                onChange={(e) => setNewWorkflowType(e.target.value as EvaluationWorkflow['type'])}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="annual">Annual</option>
                <option value="mid-year">Mid-Year</option>
                <option value="probation">Probation</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Description</label>
              <input
                type="text"
                value={newWorkflowDesc}
                onChange={(e) => setNewWorkflowDesc(e.target.value)}
                placeholder="Brief description…"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addWorkflow}
              disabled={!newWorkflowName}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Workflow
            </button>
            <button
              onClick={() => setShowNewWorkflow(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm font-500 text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow cards */}
      <div className="space-y-3">
        {workflows.map((wf) => {
          const isExpanded = expandedId === wf.id;
          const totalDays = wf.stages.reduce((sum, s) => sum + s.durationDays, 0);
          const isEditingStageHere = editingStage?.workflowId === wf.id;

          return (
            <div key={wf.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${wf.active ? 'border-border' : 'border-border opacity-70'}`}>
              {/* Workflow header */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : wf.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-700 text-foreground">{wf.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border ${TYPE_COLORS[wf.type]}`}>
                      {wf.type.charAt(0).toUpperCase() + wf.type.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{wf.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{wf.stages.length} stages</span>
                    <span>{totalDays}d total</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(wf.id); }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${wf.active ? 'bg-primary' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${wf.active ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="text-muted-foreground" />
                </div>
              </div>

              {/* Expanded stages */}
              {isExpanded && (
                <div className="border-t border-border px-5 pb-5">
                  <div className="mt-4 space-y-2">
                    {wf.stages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-700">{stage.order}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-600 text-foreground">{stage.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {stage.assignedRole.replace(/_/g, ' ')} · {stage.action} · {stage.durationDays}d
                            {stage.required && <span className="ml-1 text-red-500">*</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveStage(wf.id, stage.id, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                          >
                            <Icon name="ChevronUpIcon" size={13} />
                          </button>
                          <button
                            onClick={() => moveStage(wf.id, stage.id, 'down')}
                            disabled={idx === wf.stages.length - 1}
                            className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                          >
                            <Icon name="ChevronDownIcon" size={13} />
                          </button>
                          <button
                            onClick={() => openEditStage(wf.id, stage)}
                            className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <Icon name="PencilSquareIcon" size={13} />
                          </button>
                          <button
                            onClick={() => deleteStage(wf.id, stage.id)}
                            className="p-1 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Icon name="TrashIcon" size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {wf.stages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No stages configured yet.</p>
                    )}
                  </div>

                  {/* Stage form */}
                  {isEditingStageHere && (
                    <div className="mt-4 bg-white border border-border rounded-xl p-4">
                      <h5 className="text-xs font-700 text-foreground mb-3">
                        {editingStage?.stageId ? 'Edit Stage' : 'Add Stage'}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-600 text-foreground mb-1">Stage Name</label>
                          <input
                            type="text"
                            value={stageForm.name}
                            onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Supervisor Review"
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-600 text-foreground mb-1">Assigned Role</label>
                          <select
                            value={stageForm.assignedRole}
                            onChange={(e) => setStageForm((f) => ({ ...f, assignedRole: e.target.value }))}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-600 text-foreground mb-1">Action</label>
                          <select
                            value={stageForm.action}
                            onChange={(e) => setStageForm((f) => ({ ...f, action: e.target.value }))}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-600 text-foreground mb-1">Duration (days)</label>
                          <input
                            type="number"
                            min={1}
                            value={stageForm.durationDays}
                            onChange={(e) => setStageForm((f) => ({ ...f, durationDays: Number(e.target.value) }))}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`req-${wf.id}`}
                            checked={stageForm.required}
                            onChange={(e) => setStageForm((f) => ({ ...f, required: e.target.checked }))}
                            className="w-4 h-4 rounded border-border text-primary"
                          />
                          <label htmlFor={`req-${wf.id}`} className="text-sm text-foreground">Required stage</label>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={saveStage}
                          disabled={!stageForm.name}
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingStage?.stageId ? 'Save Stage' : 'Add Stage'}
                        </button>
                        <button
                          onClick={() => setEditingStage(null)}
                          className="px-3 py-1.5 border border-border rounded-lg text-xs font-500 text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!isEditingStageHere && (
                    <button
                      onClick={() => openAddStage(wf.id)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs font-600 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Icon name="PlusIcon" size={13} />
                      Add Stage
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
