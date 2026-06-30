'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface ReviewFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  roleFilter: string;
  onRoleChange: (v: string) => void;
}

const STATUS_OPTIONS = ['All Statuses', 'Pending', 'In Progress', 'Submitted', 'Approved', 'Overdue'];
const TYPE_OPTIONS = ['All Types', 'Mid-Year Review', 'Annual Review'];
const ROLE_OPTIONS = [
  'All Roles', 'Driver', 'Receptionist', 'HR & Admin Officer',
  'Senior ICT Officer', 'Finance Officer', 'Director of Programs',
  'DoID', 'Director of Finance', 'Director General',
];

export default function ReviewFilters({
  search, onSearchChange,
  statusFilter, onStatusChange,
  typeFilter, onTypeChange,
  roleFilter, onRoleChange,
}: ReviewFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search staff, role, or KPI..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      >
        {TYPE_OPTIONS.map((o) => <option key={`type-${o}`} value={o}>{o}</option>)}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      >
        {STATUS_OPTIONS.map((o) => <option key={`status-${o}`} value={o}>{o}</option>)}
      </select>
      <select
        value={roleFilter}
        onChange={(e) => onRoleChange(e.target.value)}
        className="px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      >
        {ROLE_OPTIONS.map((o) => <option key={`role-${o}`} value={o}>{o}</option>)}
      </select>
    </div>
  );
}