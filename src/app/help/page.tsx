'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { MANUAL_SECTIONS, type Section } from './helpData';

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<string>('getting-started');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(['getting-started-0']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleTopic = (key: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredSections = searchQuery.trim()
    ? MANUAL_SECTIONS.map((section) => ({
        ...section,
        topics: section.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.content.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
        ),
      })).filter((s) => s.topics.length > 0 || s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : MANUAL_SECTIONS;

  const currentSection: Section | undefined = filteredSections.find((s) => s.id === activeSection) ?? filteredSections[0];

  return (
    <AppLayout
      pageTitle="Help & User Manual"
      pageSubtitle="Comprehensive guide to all ECSA-HC PMS features and reports"
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
            <Icon name="BookOpenIcon" size={13} />
            v2.0 · 2026
          </span>
          <Link
            href="/user-manual/print"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
          >
            <Icon name="ArrowDownTrayIcon" size={13} />
            Download PDF Manual
          </Link>
        </div>
      }
    >
      {/* Search bar */}
      <div className="mb-5">
        <div className="relative max-w-lg">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search the user manual…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-5 min-h-[calc(100vh-200px)]">
        {/* Left nav */}
        <aside className="w-56 flex-shrink-0">
          <div className="bg-white border border-border rounded-xl overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-border bg-muted/40">
              <p className="text-[11px] font-600 uppercase tracking-widest text-muted-foreground">Modules</p>
            </div>
            <nav className="py-1.5">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setExpandedTopics(new Set());
                  }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary/10 text-primary font-600 border-l-2 border-primary' :'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent'
                  }`}
                >
                  <Icon
                    name={section.icon as Parameters<typeof Icon>[0]['name']}
                    size={15}
                    className={activeSection === section.id ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <span className="truncate">{section.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {currentSection ? (
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {/* Section header */}
              <div className={`px-6 py-5 border-b border-border ${currentSection.color.split(' ')[0]}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg border ${currentSection.color}`}>
                    <Icon name={currentSection.icon as Parameters<typeof Icon>[0]['name']} size={20} />
                  </div>
                  <div>
                    <h1 className="text-lg font-700 text-foreground">{currentSection.title}</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{currentSection.description}</p>
                  </div>
                </div>
              </div>

              {/* Topics */}
              <div className="divide-y divide-border">
                {currentSection.topics.map((topic, idx) => {
                  const key = `${currentSection.id}-${idx}`;
                  const isOpen = expandedTopics.has(key);
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggleTopic(key)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="font-600 text-sm text-foreground">{topic.title}</span>
                        <Icon
                          name={isOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                          size={16}
                          className="text-muted-foreground flex-shrink-0 ml-3"
                        />
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5 space-y-3">
                          <ul className="space-y-2.5">
                            {topic.content.map((line, i) => (
                              <li key={i} className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                          {topic.tips && topic.tips.length > 0 && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2.5">
                              <Icon name="LightBulbIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                              <div className="space-y-1.5">
                                {topic.tips.map((tip, ti) => (
                                  <p key={ti} className="text-xs text-amber-800 leading-relaxed">
                                    {tip}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center gap-2">
                <Icon name="InformationCircleIcon" size={14} className="text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  For technical support or to report an issue, contact the ECSA-HC IT Helpdesk.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl px-8 py-16 text-center">
              <Icon name="MagnifyingGlassIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-600 text-foreground">No results found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search term.</p>
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
