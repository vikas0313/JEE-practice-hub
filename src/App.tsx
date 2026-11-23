import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute, StudentLayout, MonitorLayout } from './components/Layout';
import { LoadingSkeleton } from './components/StateViews';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';

// Eager Core Pages
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import PracticeHome from './pages/student/PracticeHome';
import PracticeSession from './pages/student/PracticeSession';
import ExamSession from './pages/student/ExamSession';
import NotFound from './pages/NotFound';

// Lazy Loaded Student Secondary Pages (Code-Split)
const PracticeConfig = lazy(() => import('./pages/student/PracticeConfig'));
const PracticeSummary = lazy(() => import('./pages/student/PracticeSummary'));
const ShortcutRetry = lazy(() => import('./pages/student/ShortcutRetry'));
const StudentExams = lazy(() => import('./pages/student/StudentExams'));
const ExamInstructions = lazy(() => import('./pages/student/ExamInstructions'));
const ExamResult = lazy(() => import('./pages/student/ExamResult'));
const MistakeNotebook = lazy(() => import('./pages/student/MistakeNotebook'));
const StudentResults = lazy(() => import('./pages/student/Results'));
const StudentSettings = lazy(() => import('./pages/student/Settings'));
const StudentResultsDownload = lazy(() => import('./pages/StudentResultsDownload'));
const StudentSyllabus = lazy(() => import('./pages/student/StudentSyllabus'));
const Help = lazy(() => import('./pages/Help'));

// Lazy Loaded Monitor Pages (Code-Split)
const MonitorDashboard = lazy(() => import('./pages/monitor/Dashboard'));
const Targets = lazy(() => import('./pages/monitor/Targets'));
const PercentileMaps = lazy(() => import('./pages/monitor/PercentileMaps'));
const Weightages = lazy(() => import('./pages/monitor/Weightages'));
const Assignments = lazy(() => import('./pages/monitor/Assignments'));
const Alerts = lazy(() => import('./pages/monitor/Alerts'));
const Import = lazy(() => import('./pages/monitor/Import'));
const QuestionList = lazy(() => import('./pages/monitor/QuestionList'));
const QuestionEditor = lazy(() => import('./pages/monitor/QuestionEditor'));
const ReviewQueue = lazy(() => import('./pages/monitor/ReviewQueue'));
const PatternProfiles = lazy(() => import('./pages/monitor/PatternProfiles'));
const PaperRegistry = lazy(() => import('./pages/monitor/PaperRegistry'));
const ExamList = lazy(() => import('./pages/monitor/ExamList'));
const TestBuilder = lazy(() => import('./pages/monitor/TestBuilder'));
const ExamResultDetail = lazy(() => import('./pages/monitor/ExamResultDetail'));
const Export = lazy(() => import('./pages/monitor/Export'));
const MonitorSettings = lazy(() => import('./pages/monitor/Settings'));
const SystemStatus = lazy(() => import('./pages/monitor/SystemStatus'));
const AnalyticsProjections = lazy(() => import('./pages/monitor/AnalyticsProjections'));
const ResourceLinks = lazy(() => import('./pages/monitor/ResourceLinks'));
const ContentHealth = lazy(() => import('./pages/monitor/ContentHealth'));
const OutcomesAndCalibration = lazy(() => import('./pages/monitor/OutcomesAndCalibration'));
const FeatureFlagRegistry = lazy(() => import('./pages/monitor/FeatureFlagRegistry'));
const RevisionNotes = lazy(() => import('./pages/student/RevisionNotes'));
const SyllabusTree = lazy(() => import('./pages/monitor/SyllabusTree'));
const SyllabusAliases = lazy(() => import('./pages/monitor/SyllabusAliases'));
const ImportTopics = lazy(() => import('./pages/monitor/ImportTopics'));
const SyllabusCoverage = lazy(() => import('./pages/monitor/SyllabusCoverage'));
const DesignSystemReference = lazy(() => import('./pages/DesignSystemReference'));
const Register = lazy(() => import('./pages/Register'));
const WaitingApproval = lazy(() => import('./pages/auth/WaitingApproval'));
const RejectedNotice = lazy(() => import('./pages/auth/RejectedNotice'));
const SuspendedNotice = lazy(() => import('./pages/auth/SuspendedNotice'));
const VerifyEmailNotice = lazy(() => import('./pages/auth/VerifyEmailNotice'));
const Requests = lazy(() => import('./pages/monitor/Requests'));
const Students = lazy(() => import('./pages/monitor/Students'));

import { startSupabaseAutoSync } from './lib/supabaseSync';

export default function App() {
  React.useEffect(() => {
    startSupabaseAutoSync();
  }, []);
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteErrorBoundary>
          <Suspense fallback={<div className="max-w-7xl mx-auto p-6"><LoadingSkeleton count={3} /></div>}>
            <Routes>
            {/* Public Auth & Root Redirect */}
            <Route path="/" element={<Navigate to="/practice" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmailNotice />} />
            <Route path="/waiting-approval" element={<WaitingApproval />} />
            <Route path="/rejected" element={<RejectedNotice />} />
            <Route path="/suspended" element={<SuspendedNotice />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/design-system" element={<Navigate to="/monitor/design-system" replace />} />

            {/* Student Routes */}
            <Route element={<ProtectedRoute allowedRole="student" />}>
              <Route element={<StudentLayout />}>
                <Route path="/practice" element={<PracticeHome />} />
                <Route path="/syllabus" element={<StudentSyllabus />} />
                <Route path="/practice/config" element={<PracticeConfig />} />
                <Route path="/practice/session/:attemptId" element={<PracticeSession />} />
                <Route path="/practice/session/:attemptId/summary" element={<PracticeSummary />} />
                <Route path="/practice/shortcut-retry" element={<ShortcutRetry />} />
                <Route path="/exams" element={<StudentExams />} />
                <Route path="/exam/:id/instructions" element={<ExamInstructions />} />
                <Route path="/exam/:id/result" element={<ExamResult />} />
                <Route path="/mistakes" element={<MistakeNotebook />} />
                <Route path="/results" element={<StudentResults />} />
                <Route path="/results/download" element={<StudentResultsDownload />} />
                <Route path="/revision-notes" element={<RevisionNotes />} />
                <Route path="/help" element={<Help />} />
                <Route path="/settings" element={<StudentSettings />} />
              </Route>
              {/* Standalone CBT Screen (Full-Screen, authentic NTA CBT layout) */}
              <Route path="/exam/:id/session" element={<ExamSession />} />
            </Route>

            {/* Monitor Routes */}
            <Route element={<ProtectedRoute allowedRole="monitor" />}>
              <Route element={<MonitorLayout />}>
                <Route path="/monitor" element={<MonitorDashboard />} />
                <Route path="/monitor/requests" element={<Requests />} />
                <Route path="/monitor/students" element={<Students />} />
                <Route path="/monitor/analytics" element={<AnalyticsProjections />} />
                <Route path="/monitor/targets" element={<Targets />} />
                <Route path="/monitor/percentile-maps" element={<PercentileMaps />} />
                <Route path="/monitor/weightages" element={<Weightages />} />
                <Route path="/monitor/assignments" element={<Assignments />} />
                <Route path="/monitor/alerts" element={<Alerts />} />
                <Route path="/monitor/outcomes-and-calibration" element={<OutcomesAndCalibration />} />
                <Route path="/monitor/resource-links" element={<ResourceLinks />} />
                <Route path="/monitor/content-health" element={<ContentHealth />} />
                <Route path="/monitor/questions" element={<QuestionList />} />
                <Route path="/monitor/questions/:id" element={<QuestionEditor />} />
                <Route path="/monitor/import" element={<Import />} />
                <Route path="/monitor/review" element={<ReviewQueue />} />
                <Route path="/monitor/patterns" element={<PatternProfiles />} />
                <Route path="/monitor/papers" element={<PaperRegistry />} />
                <Route path="/monitor/exams" element={<ExamList />} />
                <Route path="/monitor/exams/new" element={<TestBuilder />} />
                <Route path="/monitor/exams/:id" element={<TestBuilder />} />
                <Route path="/monitor/exams/:id/results" element={<ExamResultDetail />} />
                <Route path="/monitor/export" element={<Export />} />
                <Route path="/monitor/system-status" element={<SystemStatus />} />
                <Route path="/monitor/feature-flags" element={<FeatureFlagRegistry />} />
                <Route path="/monitor/syllabus" element={<SyllabusTree />} />
                <Route path="/monitor/syllabus/aliases" element={<SyllabusAliases />} />
                <Route path="/monitor/syllabus/import-topics" element={<ImportTopics />} />
                <Route path="/monitor/syllabus/coverage" element={<SyllabusCoverage />} />
                <Route path="/monitor/help" element={<Help />} />
                <Route path="/monitor/settings" element={<MonitorSettings />} />
                <Route path="/monitor/design-system" element={<DesignSystemReference />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
    </AuthProvider>
  );
}
