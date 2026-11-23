import React from 'react';
import { HelpCircle, BookOpen, ShieldCheck, Keyboard, RotateCcw, WifiOff, FileCheck } from 'lucide-react';

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-gray-200 mb-8">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
          <HelpCircle size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">JEE Practice Hub Help & Guidelines</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reference guide for Class 12 JEE Main preparation and CBT exam rules
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Practice vs Exam Mode */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <BookOpen size={20} className="text-blue-600" />
            <h2>1. Practice Mode vs Exam Mode</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-1">Practice Mode</h3>
              <p>
                Self-paced learning. Active stopwatch records engaged solving time. Detailed step-by-step solutions, shortcut methods, and verification badges are revealed immediately upon submitting an answer.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-1">Exam Mode</h3>
              <p>
                Strict simulation of the official NTA Computer-Based Test (CBT). Timed countdown, full-screen enforcement, and zero feedback or solutions during the attempt. Solutions unlock only after final submission.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: CBT Anti-Cheat & Exam Rules */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <ShieldCheck size={20} className="text-blue-600" />
            <h2>2. Official CBT Rules & Integrity Enforcement</h2>
          </div>
          <ul className="space-y-2.5 text-sm text-gray-600 list-disc pl-5">
            <li>
              <strong>Full-Screen Lock:</strong> Official exams must be taken in full-screen mode on a desktop or laptop with a minimum screen resolution of 1024×768.
            </li>
            <li>
              <strong>15-Second Grace Window:</strong> Exiting full screen, minimizing the window, or switching tabs immediately displays an urgent warning. You have 15 seconds to return before your exam is automatically terminated and submitted as <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">left_fullscreen</code>.
            </li>
            <li>
              <strong>Single Attempt Policy:</strong> Each published exam allows exactly one attempt. Once submitted or timed out, the attempt cannot be reopened.
            </li>
            <li>
              <strong>Monotonic Timer:</strong> The countdown timer uses a local monotonic clock synchronized with the server to prevent system clock tampering.
            </li>
          </ul>
        </section>

        {/* Section 3: Marking Schemes */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <FileCheck size={20} className="text-blue-600" />
            <h2>3. NTA JEE Main Marking Scheme</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse border border-gray-200">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 border border-gray-200">Question Section</th>
                  <th className="p-3 border border-gray-200">Questions Count</th>
                  <th className="p-3 border border-gray-200">Correct</th>
                  <th className="p-3 border border-gray-200">Incorrect</th>
                  <th className="p-3 border border-gray-200">Unattempted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-600">
                <tr>
                  <td className="p-3 border border-gray-200 font-medium text-gray-800">Section A (MCQ)</td>
                  <td className="p-3 border border-gray-200">20 per subject (All compulsory)</td>
                  <td className="p-3 border border-gray-200 text-green-700 font-semibold">+4 marks</td>
                  <td className="p-3 border border-gray-200 text-red-600 font-semibold">-1 mark</td>
                  <td className="p-3 border border-gray-200">0 marks</td>
                </tr>
                <tr>
                  <td className="p-3 border border-gray-200 font-medium text-gray-800">Section B (Numerical)</td>
                  <td className="p-3 border border-gray-200">10 per subject (Attempt any 5)</td>
                  <td className="p-3 border border-gray-200 text-green-700 font-semibold">+4 marks</td>
                  <td className="p-3 border border-gray-200 text-red-600 font-semibold">-1 mark</td>
                  <td className="p-3 border border-gray-200">0 marks</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Note: Section B enforces a hard limit of 5 answered questions per subject. The virtual keypad locks input once 5 are submitted until an existing answer is cleared.
          </p>
        </section>

        {/* Section 4: Mistake Classification */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <RotateCcw size={20} className="text-blue-600" />
            <h2>4. Mistake Classification Guidelines</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            When reviewing wrong or unattempted questions, tag them with one of four primary error causes:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="font-bold text-red-800">Conceptual Gap:</span>
              <p className="text-red-700 mt-0.5">Did not know or misapplied the governing physical law or mathematical formula.</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="font-bold text-amber-800">Calculation Error:</span>
              <p className="text-amber-700 mt-0.5">Understood the method, but made arithmetic, algebraic, or sign slips during computation.</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="font-bold text-purple-800">Reading / Misinterpretation:</span>
              <p className="text-purple-700 mt-0.5">Misread units, missed negative conditions (e.g. "not true"), or picked incorrect option letter.</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="font-bold text-blue-800">Unfamiliar / Out of Syllabus:</span>
              <p className="text-blue-700 mt-0.5">Concept or problem structure not yet covered in study plan.</p>
            </div>
          </div>
        </section>

        {/* Section 5: Offline Buffer */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <WifiOff size={20} className="text-blue-600" />
            <h2>5. Offline Resilience & Sync</h2>
          </div>
          <p className="text-sm text-gray-600">
            If your network connection drops during an exam or practice session, all responses, timestamps, and bookmarks are automatically saved to your browser's local storage. A status badge indicates offline mode. When your connection is restored, pending responses are synchronized automatically.
          </p>
        </section>

        {/* Section 6: Keyboard Shortcuts */}
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-blue-800 font-bold text-base mb-3">
            <Keyboard size={20} className="text-blue-600" />
            <h2>6. Keyboard Shortcuts</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Select Option A, B, C, D</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">1, 2, 3, 4</kbd>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Save & Next</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">Enter</kbd>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Mark for Review & Next</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">M</kbd>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Clear Response</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">C</kbd>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Toggle Shortcuts Sheet</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">?</kbd>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Close Modals / Overlays</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-semibold text-xs">Esc</kbd>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

