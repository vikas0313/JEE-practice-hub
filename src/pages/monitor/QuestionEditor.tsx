import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getQuestion,
  getQuestionAnswerMonitor,
  getSolutionMonitor,
  updateQuestion,
  updateQuestionAnswer,
  updateSolution,
  insertQuestion,
  insertQuestionAnswer,
  insertSolution,
  getSubjects,
  getChaptersBySubject,
  getTopicsByChapter,
  getPapers,
  getSyllabusSubjects,
  getSyllabusChapters,
  getSyllabusTopics,
} from '../../lib/db';
import type {
  Question,
  QuestionAnswer,
  Solution,
  QuestionType,
  Difficulty,
  VerificationStatus,
  ShortcutType,
  FigureStatus,
  SyllabusSubject,
  SyllabusChapter,
  SyllabusTopic,
} from '../../lib/types';
import { v4 as uuid } from 'uuid';
import { KaTeXText } from '../../lib/katex-render';
import { ArrowLeft, Save, Eye } from 'lucide-react';

export default function QuestionEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const subjects = useMemo(() => getSubjects(), []);
  const papers = useMemo(() => getPapers(), []);

  // Form states
  const [number, setNumber] = useState<number>(1);
  const [paperId, setPaperId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [type, setType] = useState<QuestionType>('MCQ');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [questionText, setQuestionText] = useState<string>('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [figureRequired, setFigureRequired] = useState<boolean>(false);
  const [figureStatus, setFigureStatus] = useState<FigureStatus>('none');

  // Answer states
  const [correctAnswer, setCorrectAnswer] = useState<string>('A');
  const [answerText, setAnswerText] = useState<string>('');

  // Solution states
  const [solutionSteps, setSolutionSteps] = useState<string>('');
  const [shortcut, setShortcut] = useState<string>('');
  const [shortcutType, setShortcutType] = useState<ShortcutType | ''>('formula trick');
  const [shortcutNote, setShortcutNote] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('Reviewed');
  const [matchesKey, setMatchesKey] = useState<boolean>(true);

  const [primaryChapterId, setPrimaryChapterId] = useState<string>('');
  const [primaryTopicId, setPrimaryTopicId] = useState<string>('');

  const syllabusSubjects = useMemo(() => getSyllabusSubjects(), []);
  const controlledChapters = useMemo(() => {
    if (!subjectId) return [];
    const legacySub = subjects.find(ls => ls.id === subjectId);
    const sub = syllabusSubjects.find(s => s.id === subjectId || s.name.toLowerCase() === legacySub?.name.toLowerCase());
    if (!sub) return [];
    return getSyllabusChapters({ subjectId: sub.id, status: 'active' });
  }, [subjectId, syllabusSubjects, subjects]);

  const controlledTopics = useMemo(() => {
    if (!primaryChapterId) return [];
    return getSyllabusTopics(primaryChapterId);
  }, [primaryChapterId]);

  // Chapters & Topics based on selection
  const chapters = useMemo(() => (subjectId ? getChaptersBySubject(subjectId) : []), [subjectId]);
  const topics = useMemo(() => (chapterId ? getTopicsByChapter(chapterId) : []), [chapterId]);

  // Load existing question
  useEffect(() => {
    if (isNew) {
      if (subjects.length > 0) setSubjectId(subjects[0].id);
      if (papers.length > 0) setPaperId(papers[0].id);
      return;
    }

    const q = getQuestion(id!);
    if (!q) {
      alert('Question not found');
      navigate('/monitor/questions');
      return;
    }

    setNumber(q.number);
    setPaperId(q.paper_id);
    setSubjectId(q.subject_id);
    setChapterId(q.chapter_id);
    setTopicId(q.topic_id);
    setPrimaryChapterId(q.primary_chapter_id || '');
    setPrimaryTopicId(q.primary_topic_id || '');
    setType(q.type);
    setDifficulty(q.difficulty);
    setQuestionText(q.question_text);
    setOptions(q.options || ['', '', '', '']);
    setFigureRequired(q.figure_required);
    setFigureStatus(q.figure_status);

    const qa = getQuestionAnswerMonitor(q.id);
    if (qa) {
      setCorrectAnswer(qa.correct_answer);
      setAnswerText(qa.answer_text || '');
    }

    const sol = getSolutionMonitor(q.id);
    if (sol) {
      setSolutionSteps(sol.steps);
      setShortcut(sol.shortcut || '');
      setShortcutType(sol.shortcut_type || '');
      setShortcutNote(sol.shortcut_note || '');
      setVerificationStatus(sol.verification_status);
      setMatchesKey(sol.matches_key ?? true);
    }
  }, [id, isNew, navigate, subjects, papers]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !correctAnswer.trim() || !solutionSteps.trim()) {
      alert('Please fill question text, correct answer, and solution steps.');
      return;
    }

    const now = new Date().toISOString();

    if (isNew) {
      const qId = uuid();
      const newQ: Question = {
        id: qId,
        number,
        paper_id: paperId || (papers[0]?.id || uuid()),
        subject_id: subjectId,
        chapter_id: chapterId,
        topic_id: topicId,
        subtopic: null,
        primary_chapter_id: primaryChapterId || null,
        primary_topic_id: primaryTopicId || null,
        type,
        section: type === 'MCQ' ? 'A' : 'B',
        question_text: questionText.trim(),
        options: type === 'MCQ' ? options : null,
        figure_required: figureRequired,
        figure_status: figureStatus,
        difficulty,
        rating_source: 'reviewed',
        weightage_tag: 'Medium',
        answer_status: 'Normal',
        created_at: now,
        updated_at: now,
      };
      insertQuestion(newQ);

      insertQuestionAnswer({
        id: uuid(),
        question_id: qId,
        correct_answer: correctAnswer.trim(),
        answer_text: answerText.trim() || null,
        answer_status: 'Normal',
      });

      insertSolution({
        id: uuid(),
        question_id: qId,
        steps: solutionSteps.trim(),
        shortcut: shortcut.trim() || null,
        shortcut_type: (shortcutType as ShortcutType) || null,
        shortcut_note: shortcutNote.trim() || null,
        verification_status: verificationStatus,
        matches_key: matchesKey,
        checked_by: null,
        human_reviewed: true,
        reviewed_at: now,
        created_at: now,
        updated_at: now,
      });

      alert('New question created successfully!');
    } else {
      updateQuestion(id!, {
        number,
        paper_id: paperId,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic_id: topicId,
        primary_chapter_id: primaryChapterId || null,
        primary_topic_id: primaryTopicId || null,
        type,
        difficulty,
        question_text: questionText.trim(),
        options: type === 'MCQ' ? options : null,
        figure_required: figureRequired,
        figure_status: figureStatus,
      });

      const qa = getQuestionAnswerMonitor(id!);
      if (qa) {
        updateQuestionAnswer(qa.id, {
          correct_answer: correctAnswer.trim(),
          answer_text: answerText.trim() || null,
        });
      }

      const sol = getSolutionMonitor(id!);
      if (sol) {
        updateSolution(sol.id, {
          steps: solutionSteps.trim(),
          shortcut: shortcut.trim() || null,
          shortcut_type: (shortcutType as ShortcutType) || null,
          shortcut_note: shortcutNote.trim() || null,
          verification_status: verificationStatus,
          matches_key: matchesKey,
          human_reviewed: true,
          reviewed_at: now,
        });
      }

      alert('Question updated successfully!');
    }

    navigate('/monitor/questions');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <button
        type="button"
        onClick={() => navigate('/monitor/questions')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Question List
      </button>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Create Single Question' : `Edit Question #${number}`}
          </h1>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all"
          >
            <Save size={16} /> Save Question
          </button>
        </div>

        {/* Basic Metadata */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Question #</label>
            <input
              type="number"
              value={number}
              onChange={e => setNumber(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as QuestionType)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="MCQ">MCQ (Multiple Choice)</option>
              <option value="NVQ">NVQ (Numerical Value)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as Difficulty)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="Basic">Basic</option>
              <option value="Medium">Medium</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={e => {
                setSubjectId(e.target.value);
                setChapterId('');
                setTopicId('');
                setPrimaryChapterId('');
                setPrimaryTopicId('');
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">
              Controlled Chapter (92 Official)
            </label>
            <select
              value={primaryChapterId}
              onChange={e => {
                setPrimaryChapterId(e.target.value);
                setPrimaryTopicId('');
                setChapterId(e.target.value);
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white border-indigo-200 focus:ring-indigo-500"
            >
              <option value="">-- Select Controlled Chapter --</option>
              {controlledChapters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.external_id} — {c.name} {c.status === 'inactive' ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">
              Controlled Topic
            </label>
            <select
              value={primaryTopicId}
              onChange={e => {
                setPrimaryTopicId(e.target.value);
                setTopicId(e.target.value);
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white border-indigo-200 focus:ring-indigo-500"
            >
              <option value="">
                {controlledTopics.length === 0 && primaryChapterId
                  ? '-- No topics defined under this chapter --'
                  : '-- Select Controlled Topic --'}
              </option>
              {controlledTopics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Question Text with Live KaTeX Preview */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <label className="block text-sm font-bold text-gray-900">
            Question Text (Supports LaTeX math via $...$ or $$...$$)
          </label>
          <textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            rows={5}
            className="w-full p-3 font-mono text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Type question in LaTeX, e.g. A mass $m$ accelerates at $g\sin\theta$..."
            required
          />
          {questionText.trim() && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs uppercase font-bold text-gray-400 block mb-1.5 flex items-center gap-1">
                <Eye size={12} /> Rendered Preview
              </span>
              <div className="text-gray-900 text-sm">
                <KaTeXText text={questionText} />
              </div>
            </div>
          )}
        </div>

        {/* Options (MCQ) */}
        {type === 'MCQ' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Multiple Choice Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['A', 'B', 'C', 'D'].map((letter, idx) => (
                <div key={letter} className="space-y-1">
                  <span className="text-xs font-bold text-gray-500">Option ({letter})</span>
                  <input
                    type="text"
                    value={options[idx] || ''}
                    onChange={e => {
                      const copy = [...options];
                      copy[idx] = e.target.value;
                      setOptions(copy);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder={`Option ${letter} text or math $...$`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Correct Answer Key */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Correct Answer Key {type === 'MCQ' ? '(A, B, C, or D)' : '(Numeric Value)'}
            </label>
            <input
              type="text"
              value={correctAnswer}
              onChange={e => setCorrectAnswer(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm font-mono font-bold"
              placeholder={type === 'MCQ' ? 'A' : '6.67'}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Readable Answer Display Text (Optional)
            </label>
            <input
              type="text"
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="e.g. 6.67 cm or g sin theta"
            />
          </div>
        </div>

        {/* Solutions & Shortcut */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Step-by-step Solution & Shortcut</h3>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Step-by-step Solution (LaTeX supported)
            </label>
            <textarea
              value={solutionSteps}
              onChange={e => setSolutionSteps(e.target.value)}
              rows={6}
              className="w-full p-3 font-mono text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="**Step 1:** Apply formula..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Shortcut Explanation
              </label>
              <textarea
                value={shortcut}
                onChange={e => setShortcut(e.target.value)}
                rows={3}
                className="w-full p-3 font-mono text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Direct formula or elimination technique..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Shortcut Note (Shown when shortcut is null)
              </label>
              <textarea
                value={shortcutNote}
                onChange={e => setShortcutNote(e.target.value)}
                rows={3}
                className="w-full p-3 font-mono text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="The direct method is already the fastest..."
              />
            </div>
          </div>
        </div>

        {/* Verification Status */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Verification Status</label>
            <select
              value={verificationStatus}
              onChange={e => setVerificationStatus(e.target.value as VerificationStatus)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="Unverified">Unverified</option>
              <option value="Key-matched">Key-matched</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Flagged">Flagged</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Matches Key?</label>
            <select
              value={matchesKey ? 'yes' : 'no'}
              onChange={e => setMatchesKey(e.target.value === 'yes')}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="yes">Yes (True)</option>
              <option value="no">No (Mismatch)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Figure Status</label>
            <select
              value={figureStatus}
              onChange={e => {
                const val = e.target.value as FigureStatus;
                setFigureStatus(val);
                setFigureRequired(val !== 'none');
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="none">None (Text only)</option>
              <option value="needed">Needed (Missing diagram)</option>
              <option value="attached">Attached</option>
              <option value="redrawn">Redrawn</option>
            </select>
          </div>
        </div>
      </form>
    </div>
  );
}

