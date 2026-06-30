export interface Topic {
  title: string;
  content: string[];
  tips?: string[];
}

export interface Section {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  topics: Topic[];
}

export const MANUAL_SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'HomeIcon',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Overview of the ECSA-HC Performance Management System and how to navigate it.',
    topics: [
      {
        title: 'System Overview',
        content: [
          'The ECSA-HC Performance Management System (PMS) is a comprehensive platform for managing staff performance, evaluations, and development across all directorates.',
          'The system follows a structured workflow: Workplan Setup → Self-Assessment → Manager Review → Evaluation Comparison → Final Approval.',
          'All data is organised by review period (Mid-Year and Annual) and linked to the ECSA-HC Strategic Plan 2024–2034.',
        ],
      },
      {
        title: 'Navigation',
        content: [
          'Use the left sidebar to navigate between modules. The sidebar can be collapsed to a compact icon view by clicking the collapse button at the top.',
          'Active pages are highlighted with a coloured left border in the sidebar.',
          'Notification badges on sidebar items indicate pending actions requiring your attention.',
        ],
        tips: [
          'Hover over collapsed sidebar icons to see the full label as a tooltip.',
          'The sidebar groups modules by category: Performance, Development, Organisation, and Intelligence.',
        ],
      },
      {
        title: 'User Roles',
        content: [
          'Staff: Can complete self-assessments, view their own evaluations, and access training resources.',
          'Manager / Supervisor: Can review staff self-assessments, provide ratings and feedback, and approve or reject evaluations.',
          'HR Administrator: Has full access to all modules including staff management, permissions, and analytics.',
          'System Administrator: Manages user roles, permissions, and system-wide settings.',
        ],
      },
    ],
  },
  {
    id: 'performance-dashboard',
    title: 'Performance Dashboard',
    icon: 'ChartBarIcon',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Real-time KPI metrics, BSC perspectives, trend charts, and the ECSA-HC Strategic Plan overview.',
    topics: [
      {
        title: 'Dashboard Overview',
        content: [
          'The Performance Dashboard is the home screen, providing a live snapshot of organisational performance for the current quarter.',
          'It displays the ECSA-HC Strategic Plan 2024–2034 at the top, followed by key performance indicators, BSC charts, and at-risk staff alerts.',
          'The "Live" indicator in the top-right confirms data is refreshed in real time.',
        ],
      },
      {
        title: 'Key Performance Indicator (KPI) Cards',
        content: [
          'Metric cards show aggregate scores across the Balanced Scorecard (BSC) perspectives: Financial, Customer, Internal Processes, and Learning & Growth.',
          'Click any metric card to open a Staff Drill-Down Modal filtered to that perspective, showing individual staff scores.',
          'Colour coding: Green (≥80%) = On Track, Amber (60–79%) = Needs Attention, Red (<60%) = At Risk.',
        ],
        tips: ['Use the drill-down modal to identify specific staff members who need support.'],
      },
      {
        title: 'BSC Perspective Chart',
        content: [
          'The Balanced Scorecard chart visualises performance across all four BSC perspectives for the current fiscal year.',
          'Hover over chart segments to see exact scores and targets.',
        ],
      },
      {
        title: 'KPI Trend Chart',
        content: [
          'Shows month-by-month KPI performance trends over the selected period.',
          'Use this chart to identify seasonal patterns or the impact of interventions.',
        ],
      },
      {
        title: 'At-Risk Staff Table',
        content: [
          'Lists staff members whose performance scores fall below the threshold, requiring immediate managerial attention.',
          'Columns include staff name, directorate, current score, last review date, and recommended action.',
        ],
      },
      {
        title: 'Strategic Plan Section',
        content: [
          'Displays the full ECSA-HC Strategic Plan 2024–2034 including Vision, Mission, Core Values, Five Strategic Pillars, and Nine Strategic Objectives.',
          'Click any Strategic Objective card to expand it and view its Key Performance Indicators, cluster ownership, and timeline.',
          'Colour-coded cluster badges identify which directorate owns each objective (CHS, HSCD, FHID, MNFSN, KMME, DOF/BDU, DG/DOID).',
          'The Implementation & M&E Framework panel shows the five-level planning cascade from monthly meetings (L1) to the 10-year strategic plan (L5).',
        ],
      },
    ],
  },
  {
    id: 'evaluation-reviews',
    title: 'Evaluation & Reviews',
    icon: 'ClipboardDocumentCheckIcon',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    description: 'Manage the full appraisal lifecycle — workplan setup, evaluations, side-by-side comparisons, and final approvals.',
    topics: [
      {
        title: 'Review Table',
        content: [
          'The main table lists all staff evaluations with columns for staff name, directorate, review period, status, self-rating, supervisor rating, and actions.',
          'Filter reviews by status (Submitted / Reviewed / Approved / Rejected), review period, and staff name using the filter bar at the top.',
          'Row action icons: 👁 View details, ⚖ Open comparison modal, 🖨 Print appraisal layout.',
        ],
      },
      {
        title: 'Workplan Settings',
        content: [
          'Before evaluations begin, HR sets up the workplan for each review period using the Workplan Settings form.',
          'Settings include review period dates, KPI weights, competency weights, and the workflow stage.',
          'Workflow stages progress in order: Draft → Submitted → Mid-Year Approved → Annual Review → Completed.',
        ],
      },
      {
        title: 'Evaluation Form',
        content: [
          'The Evaluation Form captures KPI scores, competency ratings, and overall comments for a staff member.',
          'KPIs are weighted; the system auto-calculates the weighted average score.',
          'Supervisors can add narrative comments for each KPI and an overall performance summary.',
        ],
      },
      {
        title: 'Evaluation Comparison Modal',
        content: [
          'Open via the ⚖ icon on any Submitted, Reviewed, or Approved evaluation row.',
          'Three tabs: KPI Comparison (staff self-rating vs supervisor rating per KPI), Competency Comparison (all 5 general competencies side-by-side), and Overall Feedback.',
          'A variance badge shows the rating difference between self and supervisor scores.',
          'Supervisors enter their ratings in the right-hand column; the system auto-computes the supervisor average.',
          'Approve advances the workplan stage; Reject requires a written reason. Both actions have a two-step confirmation guard.',
        ],
        tips: [
          'Use the variance badge to identify KPIs where self-perception differs significantly from supervisor assessment — these are ideal coaching conversation starters.',
        ],
      },
      {
        title: 'Print Appraisal Layout',
        content: [
          'The Print Appraisal Layout generates a formatted, print-ready view of the full appraisal record.',
          'It includes staff details, all KPI scores, competency ratings, narrative comments, and approval signatures.',
          "Use your browser's Print function (Ctrl+P / Cmd+P) to print or save as PDF.",
        ],
      },
    ],
  },
  {
    id: 'self-assessment',
    title: 'Self-Assessment',
    icon: 'ClipboardDocumentListIcon',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Staff complete their own performance self-assessment through a guided 6-step wizard.',
    topics: [
      {
        title: 'Self-Assessment Wizard',
        content: [
          'The Self-Assessment is a 6-step guided wizard: (1) Select Workplan, (2) KPI Assessment, (3) General Competencies, (4) Objectives & Goals, (5) Overall Reflection, (6) Sign & Submit.',
          'Progress is shown in the step indicator at the top. You can navigate back to previous steps to review or edit before submitting.',
          'All steps must be completed before the Submit button becomes active.',
        ],
      },
      {
        title: 'Step 1 – Select Workplan',
        content: [
          'Choose the active workplan for the review period you are assessing.',
          'Only workplans in the correct workflow stage will be available for selection.',
        ],
      },
      {
        title: 'Step 2 – KPI Assessment',
        content: [
          'Rate your performance on each assigned KPI using a 1–5 scale (1 = Far Below Expectations, 5 = Exceptional).',
          'Provide an achievement description for each KPI explaining what you accomplished.',
          'Add narrative comments to give context, highlight challenges, or note supporting evidence.',
        ],
      },
      {
        title: 'Step 3 – General Competencies',
        content: [
          'Rate yourself on the five general competencies: Communication, Teamwork, Initiative, Leadership, and Professionalism.',
          'Each competency has a 1–5 rating scale and a comments field.',
        ],
      },
      {
        title: 'Step 4 – Objectives & Goals',
        content: [
          'For each objective, select the achievement status: Fully Achieved, Partially Achieved, or Not Achieved.',
          'Enter a completion percentage (0–100%) and use the visual progress bar to confirm.',
          'Add narrative comments explaining progress, obstacles, and support needed.',
        ],
      },
      {
        title: 'Step 5 – Overall Reflection',
        content: [
          'Write a free-text overall reflection summarising your performance for the period.',
          'Include key achievements, challenges faced, lessons learned, and development needs.',
        ],
      },
      {
        title: 'Step 6 – Sign & Submit',
        content: [
          'Review a summary of all your ratings before submitting.',
          'Tick the declaration checkbox to confirm the information is accurate.',
          'Click Submit to send your self-assessment to your manager for review. Submissions are saved to the mid-year reviews record and advance the workplan workflow stage.',
        ],
        tips: ['Once submitted, you cannot edit your self-assessment. Contact HR if corrections are needed.'],
      },
    ],
  },
  {
    id: 'manager-review',
    title: 'Manager Review',
    icon: 'UserGroupIcon',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Managers review submitted staff self-assessments, provide ratings and feedback, and approve or reject evaluations.',
    topics: [
      {
        title: 'Review Table',
        content: [
          'The Manager Review screen lists all staff self-assessments submitted to you for review.',
          'Filter by status (Submitted / Reviewed / Approved / Rejected), review period, or search by staff name.',
          'Click the View icon on any row to open the Review Detail Modal.',
        ],
      },
      {
        title: 'Review Detail Modal – Staff Self-Assessment Tab',
        content: [
          "The first tab shows a read-only view of the staff member's self-assessment: KPI ratings, competency scores, objectives, challenges, and overall reflection.",
          "Use this tab to understand the staff member's perspective before entering your own ratings.",
        ],
      },
      {
        title: 'Review Detail Modal – Manager Rating & Feedback Tab',
        content: [
          'Enter your rating (1–5) for each KPI and competency.',
          'Add narrative feedback in the text areas provided.',
          'Write approval comments (required for Approve) or a rejection reason (required for Reject).',
          'Save Review marks the record as Reviewed without making a final decision.',
          'Approve advances the workplan stage to mid_year_approved.',
          'Reject sets the status to Rejected and notifies the staff member.',
        ],
        tips: [
          'Both Approve and Reject have a two-step confirmation guard to prevent accidental actions.',
          'Save your feedback regularly using Save Review before making a final decision.',
        ],
      },
    ],
  },
  {
    id: 'mid-year-reviews',
    title: 'Mid-Year Reviews',
    icon: 'CalendarDaysIcon',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Track and manage mid-year review records across all staff and directorates.',
    topics: [
      {
        title: 'Mid-Year Review Overview',
        content: [
          'The Mid-Year Reviews module provides a consolidated view of all mid-year appraisal records.',
          'Records are linked to workplan settings and track the full workflow from submission to final approval.',
          'Use this module to monitor review completion rates and identify outstanding submissions.',
        ],
      },
      {
        title: 'Review Statuses',
        content: [
          'Draft: The workplan is set up but the staff member has not yet submitted their self-assessment.',
          'Submitted: The staff member has completed and submitted their self-assessment.',
          'Reviewed: The manager has saved feedback but not yet made a final decision.',
          'Approved: The manager has approved the evaluation; the workflow advances.',
          'Rejected: The manager has rejected the evaluation with a written reason.',
        ],
      },
    ],
  },
  {
    id: 'staff-management',
    title: 'Staff Management',
    icon: 'UsersIcon',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Manage staff profiles, directorate assignments, and employment records.',
    topics: [
      {
        title: 'Staff Directory',
        content: [
          'The Staff Management module displays all staff members with their name, job title, directorate, cluster, and employment status.',
          'Search by name or filter by directorate, cluster, or status to find specific staff.',
          'Click a staff record to view or edit their full profile.',
        ],
      },
      {
        title: 'Adding & Editing Staff',
        content: [
          'Click the Add Staff button to create a new staff record.',
          'Required fields: Full Name, Job Title, Directorate, Cluster, Employment Type, and Start Date.',
          'Optional fields: Email, Phone, Supervisor, and Profile Photo.',
          'Click Save to create the record. The new staff member will appear in the directory immediately.',
        ],
      },
      {
        title: 'Directorates & Clusters',
        content: [
          'Staff are organised by Directorate and Cluster, reflecting the ECSA-HC organisational structure.',
          'Directorates include: CHS, HSCD, FHID, MNFSN, KMME, DOF/BDU, and DG/DOID.',
          'Cluster assignments determine which KPIs and strategic objectives are relevant to each staff member.',
        ],
      },
    ],
  },
  {
    id: 'feedback-mentorship',
    title: 'Feedback & Mentorship',
    icon: 'ChatBubbleLeftRightIcon',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    description: 'Give and receive structured feedback, find mentors, and manage peer exchange sessions.',
    topics: [
      {
        title: 'Feedback Feed',
        content: [
          'The Feedback Feed shows all feedback you have received and given, in chronological order.',
          'Feedback entries include the sender, date, category (Commendation / Developmental / Peer), and message.',
        ],
      },
      {
        title: 'Give Feedback Modal',
        content: [
          'Click Give Feedback to open the modal.',
          'Select the recipient, choose a feedback category, and write your message.',
          'Feedback can be sent anonymously if the option is enabled by your administrator.',
        ],
      },
      {
        title: 'Mentor Directory',
        content: [
          'Browse available mentors by expertise area, directorate, or availability.',
          'Click Request Mentorship on a mentor profile to initiate a mentorship relationship.',
        ],
      },
      {
        title: 'Upcoming Sessions Panel',
        content: [
          'View all scheduled mentorship and peer exchange sessions.',
          'Sessions show the date, time, participants, and topic.',
          'Click a session to view details or join a virtual meeting link if provided.',
        ],
      },
      {
        title: 'Peer Exchange Panel',
        content: [
          'The Peer Exchange Panel facilitates structured knowledge-sharing between colleagues.',
          'Post a topic for discussion or respond to existing peer exchange threads.',
        ],
      },
    ],
  },
  {
    id: 'training-resources',
    title: 'Training & Resources',
    icon: 'AcademicCapIcon',
    color: 'bg-lime-50 text-lime-700 border-lime-200',
    description: 'Access training catalogues, CPD progress tracking, certifications, and guidance documents.',
    topics: [
      {
        title: 'Training Catalog',
        content: [
          'Browse available training programmes by category, delivery mode (online / in-person / blended), and duration.',
          'Click Enrol to register for a training programme. Your enrolment will appear in your CPD Progress table.',
        ],
      },
      {
        title: 'CPD Progress Table',
        content: [
          'Tracks your Continuing Professional Development (CPD) hours and activities for the current year.',
          'Columns include activity name, category, hours, completion date, and CPD points earned.',
          'The progress bar at the top shows your total CPD hours against the annual target.',
        ],
      },
      {
        title: 'Certification Tracker',
        content: [
          'Lists all professional certifications held by the staff member, including issue date, expiry date, and renewal status.',
          'Certificates approaching expiry are highlighted in amber; expired certificates are shown in red.',
        ],
      },
      {
        title: 'Guidance Documents',
        content: [
          'A library of HR policies, performance management guidelines, and reference documents.',
          'Documents can be downloaded as PDF or viewed in-browser.',
          'Use the search bar to find documents by title or keyword.',
        ],
      },
    ],
  },
  {
    id: 'analytics-reports',
    title: 'Analytics & Reports',
    icon: 'PresentationChartLineIcon',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Organisation-wide performance analytics, framework reports, and data export tools.',
    topics: [
      {
        title: 'KPI Year-on-Year Chart',
        content: [
          'Compares KPI performance across multiple fiscal years to identify long-term trends.',
          'Use the year selector to choose which years to compare.',
          'Hover over data points for exact values.',
        ],
      },
      {
        title: 'BSC Scorecard Matrix',
        content: [
          'A matrix view of Balanced Scorecard performance across all directorates and perspectives.',
          'Cells are colour-coded: Green (On Track), Amber (Needs Attention), Red (At Risk).',
          'Click a cell to drill down into the underlying KPI data.',
        ],
      },
      {
        title: 'JEESP-AR Chart',
        content: [
          'Tracks performance against the Joint External Evaluation of State Party Abilities for Reporting (JEESP-AR) framework indicators.',
          'Shows progress scores for each technical area assessed.',
        ],
      },
      {
        title: 'HEPRR Progress Chart',
        content: [
          'Monitors progress on Health Emergency Preparedness, Response, and Resilience (HEPRR) indicators.',
          'Displays current scores against targets for each HEPRR domain.',
        ],
      },
      {
        title: 'WBN-o-Pipeline Table',
        content: [
          'Lists World Bank No-Pipeline projects and their performance status.',
          'Columns include project name, directorate, budget, disbursement rate, and status.',
        ],
      },
      {
        title: 'Reports Export Panel',
        content: [
          'Generate and download reports in Excel (.xlsx) or PDF format.',
          'Available report types: Staff Performance Summary, Directorate Scorecard, KPI Trend Report, Evaluation Completion Report.',
          'Select the report type, date range, and directorate filter, then click Generate Report.',
        ],
        tips: ['Large reports may take a few seconds to generate. Do not close the browser tab while the download is in progress.'],
      },
    ],
  },
  {
    id: 'permissions',
    title: 'Permissions',
    icon: 'ShieldCheckIcon',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    description: 'Manage user roles, access levels, and module permissions for all system users.',
    topics: [
      {
        title: 'Roles Overview',
        content: [
          'The Permissions module is accessible to HR Administrators and System Administrators only.',
          'Four built-in roles: Staff, Manager, HR Administrator, and System Administrator.',
          'Each role has a predefined set of module access permissions that can be customised.',
        ],
      },
      {
        title: 'Assigning Roles',
        content: [
          'Search for a user by name or email.',
          'Select the desired role from the dropdown and click Assign Role.',
          "Role changes take effect immediately on the user's next page load.",
        ],
      },
      {
        title: 'Module Permissions',
        content: [
          'Each module can be set to: No Access, View Only, or Full Access for each role.',
          'Changes to module permissions apply to all users with that role.',
          'Use the Permission Matrix table to review and update access levels in bulk.',
        ],
        tips: ['Always test permission changes with a non-admin account before rolling out to all users.'],
      },
    ],
  },
];
