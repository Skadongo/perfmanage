'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';

interface GiveFeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

interface FeedbackFormValues {
  recipient: string;
  feedbackType: string;
  competency: string;
  rating: number;
  message: string;
  actionRequired: boolean;
  actionDescription: string;
}

const STAFF_OPTIONS = [
  'Amara Mensah — HR & Admin Officer',
  'Boniface Ochieng — Finance Officer',
  'Fatuma Rashid — Senior ICT Officer',
  'Ntombi Dlamini — HR & Admin Officer',
  'Emmanuel Nkurunziza — Driver',
  'Zawadi Mwangi — Receptionist',
  'Prosper Habimana — Director of Programs',
  'Dr. Salome Wanjiru — Director of Finance',
  'Mr. Kwame Asante — DoID',
];

const COMPETENCIES = [
  'Finance / Stewardship',
  'Customer / Operations',
  'Business Process',
  'Organizational Capacity',
  'Leadership',
  'Communication & Advocacy',
  'Technical Expertise',
];

const FEEDBACK_TYPES = ['Supervisor → Staff', 'Peer Feedback', 'Upward Feedback', 'Project-Based'];

export default function GiveFeedbackModal({ open, onClose }: GiveFeedbackModalProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FeedbackFormValues>({
    defaultValues: { actionRequired: false },
  });

  const actionRequired = watch('actionRequired');

  const onSubmit = async (data: FeedbackFormValues) => {
    if (selectedRating === 0) return;
    setIsSubmitting(true);
    // Backend integration point: POST /api/feedback
    await new Promise(r => setTimeout(r, 800));
    setIsSubmitting(false);
    toast.success('Feedback submitted successfully', { description: `${data.recipient.split('—')[0].trim()} will be notified.` });
    reset();
    setSelectedRating(0);
    onClose();
  };

  const RATING_LABELS: Record<number, string> = {
    1: 'Unsatisfactory', 2: 'Needs Improvement', 3: 'Meets Expectations',
    4: 'Exceeds Expectations', 5: 'Outstanding',
  };

  return (
    <Modal open={open} onClose={onClose} title="Give Feedback" subtitle="Provide structured performance feedback to a colleague" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Recipient */}
        <div>
          <label className="block text-xs font-700 text-foreground mb-1">
            Recipient <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">Select the staff member you are providing feedback for</p>
          <select
            {...register('recipient', { required: 'Please select a recipient' })}
            className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">Select staff member...</option>
            {STAFF_OPTIONS.map((s) => <option key={`rec-${s}`} value={s}>{s}</option>)}
          </select>
          {errors.recipient && <p className="text-xs text-destructive mt-1">{errors.recipient.message}</p>}
        </div>

        {/* Type + Competency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-700 text-foreground mb-1">
              Feedback Type <span className="text-destructive">*</span>
            </label>
            <select
              {...register('feedbackType', { required: 'Required' })}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Select type...</option>
              {FEEDBACK_TYPES.map((t) => <option key={`ftype-${t}`} value={t}>{t}</option>)}
            </select>
            {errors.feedbackType && <p className="text-xs text-destructive mt-1">{errors.feedbackType.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-700 text-foreground mb-1">
              BSC Competency <span className="text-destructive">*</span>
            </label>
            <select
              {...register('competency', { required: 'Required' })}
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Select competency...</option>
              {COMPETENCIES.map((c) => <option key={`comp-${c}`} value={c}>{c}</option>)}
            </select>
            {errors.competency && <p className="text-xs text-destructive mt-1">{errors.competency.message}</p>}
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-xs font-700 text-foreground mb-1">
            Performance Rating <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-2">Rate against the ECSA-HC performance standards (1 = Unsatisfactory, 5 = Outstanding)</p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={`star-btn-${star}`}
                type="button"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setSelectedRating(star)}
                className="transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rate ${star}`}
              >
                <Icon
                  name="StarIcon"
                  size={24}
                  className={`transition-colors ${star <= (hoveredRating || selectedRating) ? 'text-amber-400' : 'text-muted-foreground'}`}
                  variant={star <= (hoveredRating || selectedRating) ? 'solid' : 'outline'}
                />
              </button>
            ))}
            {(hoveredRating || selectedRating) > 0 && (
              <span className="text-xs font-600 text-amber-700 ml-2">{RATING_LABELS[hoveredRating || selectedRating]}</span>
            )}
          </div>
          {selectedRating === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Please select a rating to continue</p>
          )}
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-700 text-foreground mb-1">
            Feedback Message <span className="text-destructive">*</span>
          </label>
          <p className="text-[11px] text-muted-foreground mb-1.5">Be specific — reference observable behaviors, KPI data, or project outcomes</p>
          <textarea
            {...register('message', {
              required: 'Feedback message is required',
              minLength: { value: 50, message: 'Please provide at least 50 characters for meaningful feedback' },
            })}
            rows={4}
            placeholder="Describe specific behaviors, achievements, or areas for improvement with reference to agreed KPIs..."
            className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          {errors.message && <p className="text-xs text-destructive mt-1">{errors.message.message}</p>}
        </div>

        {/* Action required */}
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <input
            type="checkbox"
            id="actionRequired"
            {...register('actionRequired')}
            className="mt-0.5 accent-primary"
          />
          <div>
            <label htmlFor="actionRequired" className="text-sm font-600 text-foreground cursor-pointer">
              Action Required
            </label>
            <p className="text-[11px] text-muted-foreground">Check if this feedback requires the recipient to take a specific action</p>
          </div>
        </div>

        {actionRequired && (
          <div className="animate-fade-in">
            <label className="block text-xs font-700 text-foreground mb-1">Required Action</label>
            <textarea
              {...register('actionDescription', { required: actionRequired ? 'Please describe the required action' : false })}
              rows={2}
              placeholder="Describe the specific action the staff member should take and by when..."
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {errors.actionDescription && <p className="text-xs text-destructive mt-1">{errors.actionDescription.message}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || selectedRating === 0}
            className="px-4 py-2 text-sm font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[130px] justify-center"
          >
            {isSubmitting ? (
              <>
                <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Icon name="PaperAirplaneIcon" size={14} />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}