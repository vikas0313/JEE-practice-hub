import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { markOnboardingCompleted } from '../lib/db';
import type { Role } from '../lib/types';

interface OnboardingModalProps {
  userId: string;
  role: Role;
  onComplete: () => void;
}

export function OnboardingModal({ userId, role, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  const studentSteps = [
    {
      title: 'Distraction-Free Practice',
      description:
        'Practice official JEE Main questions with zero pressure. Private family practice with no public comparisons or pop-ups. Focus exclusively on mastering concepts.',
      icon: BookOpen,
      highlight: 'Take your time to understand each problem deeply.',
    },
    {
      title: 'Authentic CBT Exam Interface',
      description:
        'Official NTA 5-state question palette, exact Section A (MCQs) & Section B (Numericals with choose 5 rule), on-screen virtual keypad, and realistic full-screen exam conditions.',
      icon: ShieldCheck,
      highlight: 'Simulate the exact test centre experience from your desktop.',
    },
    {
      title: 'Step-by-Step Solutions & Mistake Notebook',
      description:
        'Answers and shortcuts are revealed after you submit. Classify your errors (concept vs calculation vs careless) in your Mistake Notebook to strengthen weak areas.',
      icon: Sparkles,
      highlight: 'Every mistake is a learning opportunity.',
    },
  ];

  const monitorSteps = [
    {
      title: 'Official NTA Paper Registry',
      description:
        'Verify question papers and pattern profiles against the official Information Bulletin before publishing. Ensure exact marking schemes and syllabus adherence.',
      icon: ShieldCheck,
      highlight: 'Database-level hard gates prevent unverified questions from reaching exams.',
    },
    {
      title: 'Objective Bayesian Chance Estimation',
      description:
        'Track student readiness using Bayesian shrinkage models based exclusively on first-attempt practice answers. Calibrated marks-to-percentile curves provide reliable progress projections.',
      icon: Sparkles,
      highlight: 'Repeat drilling never distorts the baseline estimation.',
    },
    {
      title: 'Quiet Monitoring & Alert Rules',
      description:
        'All alerts, pacing warnings, and weekly digests route exclusively to your email. The student is never spammed with automated messages or pressure-inducing notifications.',
      icon: BookOpen,
      highlight: 'A respectful, distraction-free environment for Class 12 preparation.',
    },
  ];

  const steps = role === 'student' ? studentSteps : monitorSteps;
  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const handleFinish = () => {
    try {
      markOnboardingCompleted(userId);
    } catch (e) {
      console.error('Failed to mark onboarding complete', e);
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-full mb-3">
            <Icon size={32} className="text-blue-200" />
          </div>
          <h2 className="text-xl font-bold">{currentStep.title}</h2>
          <p className="text-xs text-blue-200 mt-1">
            Step {step + 1} of {steps.length} — Welcome to JEE Practice Hub
          </p>
        </div>

        {/* Body content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 leading-relaxed">{currentStep.description}</p>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 font-medium flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span>{currentStep.highlight}</span>
          </div>

          {/* Stepper dots */}
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === step ? 'w-6 bg-blue-600' : 'w-2 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Get Started</span>
                <CheckCircle2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
