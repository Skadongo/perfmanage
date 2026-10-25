'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import WorkplanBulkUpload from '@/app/evaluation-reviews/components/WorkplanBulkUpload';
import WorkplanDocumentImport from '@/app/evaluation-reviews/components/WorkplanDocumentImport';

export default function WorkplanUploadPage() {
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="ArrowUpTrayIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-700 text-foreground">Upload Workplan</h1>
              <p className="text-sm text-muted-foreground">
                Import staff workplans from Excel/CSV or Word/PDF documents
              </p>
            </div>
          </div>
          <div className="mt-4 h-px bg-border" />
        </div>

        {/* Import Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Excel / CSV Card */}
          <button
            onClick={() => setShowExcelUpload(true)}
            className="group text-left bg-white border border-border rounded-2xl p-6 hover:border-emerald-400 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Icon name="TableCellsIcon" size={28} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-700 text-foreground mb-1">Import Excel / CSV</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Bulk-import multiple staff workplans from a structured spreadsheet. Ideal for HR teams managing large staff lists.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['.xlsx', '.xls', '.csv']?.map((ext) => (
                    <span
                      key={ext}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-600 text-emerald-600 group-hover:gap-3 transition-all">
              <span>Start Import</span>
              <Icon name="ArrowRightIcon" size={16} />
            </div>
          </button>

          {/* Word / PDF Card */}
          <button
            onClick={() => setShowDocUpload(true)}
            className="group text-left bg-white border border-border rounded-2xl p-6 hover:border-violet-400 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                <Icon name="DocumentTextIcon" size={28} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-700 text-foreground mb-1">Import Word / PDF</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Parse a Word or PDF document and auto-fill the workplan form. Supports the ECSA-HC Individual Performance Contract format.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['.docx', '.doc', '.pdf']?.map((ext) => (
                    <span
                      key={ext}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 bg-violet-50 text-violet-700 border border-violet-200"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-600 text-violet-600 group-hover:gap-3 transition-all">
              <span>Start Import</span>
              <Icon name="ArrowRightIcon" size={16} />
            </div>
          </button>
        </div>

        {/* Info note */}
        <div className="mt-8 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Icon name="InformationCircleIcon" size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Uploaded workplans are validated before saving. You can review and correct any errors before confirming the import.
            All imports are linked to the ECSA-HC Individual Performance Contract format.
          </p>
        </div>
      </div>

      {/* Modals */}
      {showExcelUpload && (
        <WorkplanBulkUpload
          onClose={() => setShowExcelUpload(false)}
          onComplete={() => setShowExcelUpload(false)}
        />
      )}

      {showDocUpload && (
        <WorkplanDocumentImport
          onClose={() => setShowDocUpload(false)}
          onPrefill={() => setShowDocUpload(false)}
        />
      )}
    </AppLayout>
  );
}
