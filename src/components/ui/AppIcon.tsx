'use client';

import React from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

type IconVariant = 'outline' | 'solid';

interface IconProps {
    name: string;
    variant?: IconVariant;
    size?: number;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: any;
}

/**
 * ECSA-HC Branded Icon Alias Map
 * Maps semantic ECSA-HC domain names → specific HeroIcon names.
 * This gives the app a consistent, health-sector-specific visual language
 * while still leveraging the HeroIcons library.
 */
const ECSA_ICON_ALIASES: Record<string, string> = {
  // ── Navigation ──────────────────────────────────────────────────────────────
  'EcsaHomeIcon':               'HomeModernIcon',
  'EcsaDashboardIcon':          'Squares2X2Icon',
  'EcsaPerformanceIcon':        'PresentationChartBarIcon',
  'EcsaEvaluationIcon':         'ClipboardDocumentCheckIcon',
  'EcsaMidYearIcon':            'CalendarDaysIcon',
  'EcsaFeedbackIcon':           'ChatBubbleLeftEllipsisIcon',
  'EcsaTrainingIcon':           'AcademicCapIcon',
  'EcsaStaffIcon':              'UserGroupIcon',
  'EcsaPermissionsIcon':        'ShieldCheckIcon',
  'EcsaAnalyticsIcon':          'ChartBarSquareIcon',
  'EcsaSettingsIcon':           'AdjustmentsHorizontalIcon',

  // ── Actions ─────────────────────────────────────────────────────────────────
  'EcsaNewIcon':                'PlusCircleIcon',
  'EcsaExportIcon':             'ArrowDownTrayIcon',
  'EcsaImportIcon':             'ArrowUpTrayIcon',
  'EcsaSearchIcon':             'MagnifyingGlassCircleIcon',
  'EcsaFilterIcon':             'FunnelIcon',
  'EcsaSaveIcon':               'BookmarkIcon',
  'EcsaEditIcon':               'PencilSquareIcon',
  'EcsaDeleteIcon':             'TrashIcon',
  'EcsaViewIcon':               'EyeIcon',
  'EcsaCloseIcon':              'XCircleIcon',
  'EcsaPrintIcon':              'PrinterIcon',
  'EcsaShareIcon':              'ShareIcon',
  'EcsaRefreshIcon':            'ArrowPathIcon',
  'EcsaDownloadIcon':           'ArrowDownTrayIcon',
  'EcsaUploadIcon':             'ArrowUpTrayIcon',
  'EcsaScheduleIcon':           'ClockIcon',
  'EcsaNotifyIcon':             'BellAlertIcon',

  // ── Workflow / Status ────────────────────────────────────────────────────────
  'EcsaApprovedIcon':           'CheckBadgeIcon',
  'EcsaPendingIcon':            'ClockIcon',
  'EcsaRejectedIcon':           'XCircleIcon',
  'EcsaDraftIcon':              'DocumentTextIcon',
  'EcsaSubmittedIcon':          'PaperAirplaneIcon',
  'EcsaReviewedIcon':           'ClipboardDocumentCheckIcon',
  'EcsaLockedIcon':             'LockClosedIcon',
  'EcsaUnlockedIcon':           'LockOpenIcon',
  'EcsaProgressIcon':           'ArrowTrendingUpIcon',
  'EcsaWarningIcon':            'ExclamationTriangleIcon',
  'EcsaInfoIcon':               'InformationCircleIcon',
  'EcsaSuccessIcon':            'CheckCircleIcon',
  'EcsaErrorIcon':              'ExclamationCircleIcon',
  'EcsaStageIcon':              'ArrowsRightLeftIcon',
  'EcsaWorkflowIcon':           'ArrowPathRoundedSquareIcon',

  // ── Health / ECSA-HC Domain ──────────────────────────────────────────────────
  'EcsaHealthIcon':             'HeartIcon',
  'EcsaHealthSystemIcon':       'BuildingOffice2Icon',
  'EcsaCapacityIcon':           'ChartBarIcon',
  'EcsaFrameworkIcon':          'RectangleGroupIcon',
  'EcsaBSCIcon':                'TableCellsIcon',
  'EcsaKPIIcon':                'BoltIcon',
  'EcsaObjectiveIcon':          'FlagIcon',
  'EcsaMilestoneIcon':          'TrophyIcon',
  'EcsaRatingIcon':             'StarIcon',
  'EcsaScoreIcon':              'CalculatorIcon',
  'EcsaReportIcon':             'DocumentChartBarIcon',
  'EcsaCertIcon':               'IdentificationIcon',
  'EcsaCPDIcon':                'BookOpenIcon',
  'EcsaMentorIcon':             'UserIcon',
  'EcsaPeerIcon':               'UsersIcon',
  'EcsaDirectorateIcon':        'BuildingLibraryIcon',
  'EcsaClusterIcon':            'CircleStackIcon',
  'EcsaRegionIcon':             'GlobeAltIcon',
  'EcsaCountryIcon':            'MapPinIcon',

  // ── Contact / Communication ──────────────────────────────────────────────────
  'EcsaPhoneIcon':              'PhoneArrowUpRightIcon',
  'EcsaEmailIcon':              'EnvelopeOpenIcon',
  'EcsaWebIcon':                'GlobeAltIcon',
  'EcsaContactIcon':            'IdentificationIcon',

  // ── UI Utility ───────────────────────────────────────────────────────────────
  'EcsaMenuIcon':               'Bars3CenterLeftIcon',
  'EcsaCollapseIcon':           'ChevronDoubleLeftIcon',
  'EcsaExpandIcon':             'ChevronDoubleRightIcon',
  'EcsaChevronDownIcon':        'ChevronDownIcon',
  'EcsaChevronUpIcon':          'ChevronUpIcon',
  'EcsaChevronLeftIcon':        'ChevronLeftIcon',
  'EcsaChevronRightIcon':       'ChevronRightIcon',
  'EcsaSortIcon':               'BarsArrowDownIcon',
  'EcsaMoreIcon':               'EllipsisHorizontalCircleIcon',
  'EcsaLinkIcon':               'ArrowTopRightOnSquareIcon',
  'EcsaTagIcon':                'TagIcon',
  'EcsaBadgeIcon':              'SparklesIcon',
  'EcsaCalendarIcon':           'CalendarDaysIcon',
  'EcsaDateIcon':               'CalendarIcon',
  'EcsaTimeIcon':               'ClockIcon',
  'EcsaUserIcon':               'UserCircleIcon',
  'EcsaUserAddIcon':            'UserPlusIcon',
  'EcsaUserRemoveIcon':         'UserMinusIcon',
  'EcsaDocIcon':                'DocumentTextIcon',
  'EcsaFolderIcon':             'FolderOpenIcon',
  'EcsaAttachIcon':             'PaperClipIcon',
  'EcsaLiveIcon':               'SignalIcon',
};

function resolveIconName(name: string): string {
  return ECSA_ICON_ALIASES[name] ?? name;
}

function Icon({
    name,
    variant = 'outline',
    size = 24,
    className = '',
    onClick,
    disabled = false,
    ...props
}: IconProps) {
    const resolved = resolveIconName(name);
    const iconSet = variant === 'solid' ? HeroIconsSolid : HeroIcons;
    const IconComponent = iconSet[resolved as keyof typeof iconSet] as React.ComponentType<any>;

    if (!IconComponent) {
        return (
            <QuestionMarkCircleIcon
                width={size}
                height={size}
                className={`text-gray-400 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
                onClick={disabled ? undefined : onClick}
                {...props}
            />
        );
    }

    return (
        <IconComponent
            width={size}
            height={size}
            className={`${disabled ? 'opacity-50 cursor-not-allowed' : onClick ? 'cursor-pointer hover:opacity-80' : ''} ${className}`}
            onClick={disabled ? undefined : onClick}
            {...props}
        />
    );
}

export default Icon;