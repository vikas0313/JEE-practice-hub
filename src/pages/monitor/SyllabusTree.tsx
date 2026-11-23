// ============================================================
// JEE Practice Hub — Controlled Syllabus Tree Manager (Step 5)
// Subject > Group > Chapter > Topic > Subtopic interactive hierarchy
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import {
  getSyllabusSubjects,
  getSyllabusGroups,
  getSyllabusChapters,
  getSyllabusTopics,
  getSyllabusSubtopics,
  updateSyllabusChapter,
  updateSyllabusTopic,
  insertSyllabusTopic,
  insertSyllabusSubtopic,
  deleteSyllabusChapter,
  deleteSyllabusTopic,
  deleteSyllabusSubtopic,
} from '../../lib/db';
import {
  checkChapterDeletion,
  checkTopicDeletion,
  confirmChapterSyllabus,
  moveTopic,
  mergeChapters,
  mergeTopics,
} from '../../lib/syllabusOps';
import { generateSlug } from '../../lib/syllabusSeed';
import type {
  SyllabusSubject,
  SyllabusGroup,
  SyllabusChapter,
  SyllabusTopic,
  SyllabusSubtopic,
} from '../../lib/types';
import {
  BookOpen,
  FolderTree,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  GitMerge,
  ArrowRightLeft,
  FileCheck,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SyllabusTree() {
  const [subjects, setSubjects] = useState<SyllabusSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [groups, setGroups] = useState<SyllabusGroup[]>([]);
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [subtopics, setSubtopics] = useState<SyllabusSubtopic[]>([]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  // Modals
  const [confirmModalChapter, setConfirmModalChapter] = useState<SyllabusChapter | null>(null);
  const [confirmNote, setConfirmNote] = useState('');

  const [addTopicModalChapter, setAddTopicModalChapter] = useState<SyllabusChapter | null>(null);
  const [newTopicName, setNewTopicName] = useState('');

  const [addSubtopicModalTopic, setAddSubtopicModalTopic] = useState<SyllabusTopic | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState('');

  const [mergeChapterModal, setMergeChapterModal] = useState<SyllabusChapter | null>(null);
  const [targetChapterId, setTargetChapterId] = useState('');

  const [moveTopicModal, setMoveTopicModal] = useState<SyllabusTopic | null>(null);
  const [moveTargetChapterId, setMoveTargetChapterId] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = () => {
    const sList = getSyllabusSubjects();
    setSubjects(sList);
    if (sList.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(sList[0].id);
    }
    setGroups(getSyllabusGroups());
    setChapters(getSyllabusChapters());
    setTopics(getSyllabusTopics());
    setSubtopics(getSyllabusSubtopics());
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeSubject = useMemo(
    () => subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const filteredGroups = useMemo(
    () => groups.filter(g => g.subject_id === selectedSubjectId),
    [groups, selectedSubjectId]
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleToggleChapterActive = (ch: SyllabusChapter) => {
    const newStatus = ch.status === 'active' ? 'inactive' : 'active';
    updateSyllabusChapter(ch.id, { status: newStatus });
    loadData();
    setNotification({
      type: 'success',
      message: `Chapter "${ch.name}" is now ${newStatus}.`,
    });
  };

  const handleConfirmSyllabus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalChapter) return;
    try {
      confirmChapterSyllabus(confirmModalChapter.id, 'monitor', confirmNote);
      setConfirmModalChapter(null);
      setConfirmNote('');
      loadData();
      setNotification({
        type: 'success',
        message: `Chapter "${confirmModalChapter.name}" verified and confirmed for official syllabus!`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTopicModalChapter || !newTopicName.trim()) return;
    try {
      insertSyllabusTopic({
        id: uuid(),
        chapter_id: addTopicModalChapter.id,
        name: newTopicName.trim(),
        slug: generateSlug(newTopicName.trim()),
        sort_order: topics.filter(t => t.chapter_id === addTopicModalChapter.id).length + 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setAddTopicModalChapter(null);
      setNewTopicName('');
      loadData();
      setNotification({
        type: 'success',
        message: `Topic added under "${addTopicModalChapter.name}".`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleAddSubtopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSubtopicModalTopic || !newSubtopicName.trim()) return;
    try {
      insertSyllabusSubtopic({
        id: uuid(),
        topic_id: addSubtopicModalTopic.id,
        name: newSubtopicName.trim(),
        slug: generateSlug(newSubtopicName.trim()),
        sort_order: subtopics.filter(st => st.topic_id === addSubtopicModalTopic.id).length + 1,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setAddSubtopicModalTopic(null);
      setNewSubtopicName('');
      loadData();
      setNotification({
        type: 'success',
        message: `Subtopic added under "${addSubtopicModalTopic.name}".`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleDeleteChapter = (ch: SyllabusChapter) => {
    const check = checkChapterDeletion(ch.id);
    if (!check.canDelete) {
      if (confirm(`${check.reason}\n\nWould you like to DEACTIVATE this chapter instead?`)) {
        updateSyllabusChapter(ch.id, { status: 'inactive' });
        loadData();
        setNotification({
          type: 'success',
          message: `Chapter "${ch.name}" deactivated.`,
        });
      }
      return;
    }

    if (confirm(`Are you sure you want to permanently delete chapter "${ch.name}"?`)) {
      deleteSyllabusChapter(ch.id);
      loadData();
      setNotification({
        type: 'success',
        message: `Chapter "${ch.name}" deleted.`,
      });
    }
  };

  const handleDeleteTopic = (t: SyllabusTopic) => {
    const check = checkTopicDeletion(t.id);
    if (!check.canDelete) {
      if (confirm(`${check.reason}\n\nWould you like to DEACTIVATE this topic instead?`)) {
        updateSyllabusTopic(t.id, { status: 'inactive' });
        loadData();
        setNotification({
          type: 'success',
          message: `Topic "${t.name}" deactivated.`,
        });
      }
      return;
    }

    if (confirm(`Are you sure you want to permanently delete topic "${t.name}"?`)) {
      deleteSyllabusTopic(t.id);
      loadData();
      setNotification({
        type: 'success',
        message: `Topic "${t.name}" deleted.`,
      });
    }
  };

  const handleMergeChapterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeChapterModal || !targetChapterId) return;
    try {
      const res = mergeChapters(mergeChapterModal.id, targetChapterId, 'monitor');
      setMergeChapterModal(null);
      setTargetChapterId('');
      loadData();
      setNotification({
        type: 'success',
        message: `Merged into target chapter: ${res.topicsMoved} topics moved, ${res.questionsRepointed} questions repointed, alias created.`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleMoveTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTopicModal || !moveTargetChapterId) return;
    try {
      const res = moveTopic(moveTopicModal.id, moveTargetChapterId, 'monitor');
      setMoveTopicModal(null);
      setMoveTargetChapterId('');
      loadData();
      setNotification({
        type: 'success',
        message: `Topic moved to new chapter (${res.repointedQuestions} questions repointed).`,
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FolderTree className="text-indigo-600" size={26} />
            Controlled Syllabus Manager
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Authoritative 5-tier taxonomy (Subject &gt; Group &gt; Chapter &gt; Topic &gt; Subtopic) for Practice &amp; Ingestion.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <Link
            to="/monitor/syllabus/aliases"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <ArrowRightLeft size={14} />
            Aliases
          </Link>
          <Link
            to="/monitor/syllabus/import-topics"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <Plus size={14} />
            Import Topics CSV
          </Link>
          <Link
            to="/monitor/syllabus/coverage"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm"
          >
            <Layers size={14} />
            Coverage Report
          </Link>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold uppercase ml-4 text-gray-500 hover:text-gray-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subject Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 pt-2 rounded-t-xl shadow-sm">
        {subjects.map(s => {
          const isSelected = s.id === selectedSubjectId;
          const subChapters = chapters.filter(c => c.subject_id === s.id);
          const activeCount = subChapters.filter(c => c.status === 'active').length;

          return (
            <button
              key={s.id}
              onClick={() => setSelectedSubjectId(s.id)}
              className={`px-5 py-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
                isSelected
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{s.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-normal">
                {activeCount}/{subChapters.length} active
              </span>
            </button>
          );
        })}
      </div>

      {/* Tree Content */}
      <div className="bg-white rounded-b-xl border border-gray-200 divide-y divide-gray-100 shadow-sm p-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No groups found for this subject.
          </div>
        ) : (
          filteredGroups.map(group => {
            const groupChapters = chapters.filter(c => c.group_id === group.id);
            const isGroupExpanded = expandedGroups[group.id] ?? true;

            return (
              <div key={group.id} className="py-3">
                {/* Group Header */}
                <div
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                    {isGroupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span>{group.name}</span>
                    <span className="text-xs font-normal text-gray-500">
                      ({groupChapters.length} chapters)
                    </span>
                  </div>
                </div>

                {/* Chapters inside Group */}
                {isGroupExpanded && (
                  <div className="pl-6 pt-2 space-y-2">
                    {groupChapters.map(chapter => {
                      const chapterTopics = topics.filter(t => t.chapter_id === chapter.id);
                      const isChapterExpanded = expandedChapters[chapter.id] ?? false;

                      return (
                        <div
                          key={chapter.id}
                          className={`border rounded-lg p-3 transition-colors ${
                            chapter.status === 'inactive'
                              ? 'bg-gray-50/70 border-gray-200 opacity-80'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          {/* Chapter Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div
                              onClick={() => toggleChapter(chapter.id)}
                              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                            >
                              {chapterTopics.length > 0 ? (
                                isChapterExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />
                              ) : (
                                <div className="w-3.5" />
                              )}
                              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">
                                {chapter.external_id || 'CH'}
                              </span>
                              <span className="font-semibold text-gray-900 text-sm truncate">
                                {chapter.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({chapterTopics.length} topics)
                              </span>
                            </div>

                            {/* Status Badges & Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Active / Inactive Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleChapterActive(chapter)}
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  chapter.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {chapter.status}
                              </button>

                              {/* Syllabus Status Pill */}
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                                  chapter.syllabus_status === 'confirmed'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : chapter.syllabus_status === 'verify_current_syllabus'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {chapter.syllabus_status === 'confirmed' && <CheckCircle size={12} />}
                                {chapter.syllabus_status === 'verify_current_syllabus' && <AlertTriangle size={12} />}
                                {chapter.syllabus_status.replace(/_/g, ' ')}
                              </span>

                              {/* Confirm Syllabus Button */}
                              {chapter.syllabus_status !== 'confirmed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModalChapter(chapter);
                                    setConfirmNote(chapter.source_note || '');
                                  }}
                                  className="text-xs px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 font-medium flex items-center gap-1"
                                >
                                  <FileCheck size={12} />
                                  Confirm
                                </button>
                              )}

                              {/* Add Topic */}
                              <button
                                type="button"
                                onClick={() => setAddTopicModalChapter(chapter)}
                                className="text-xs p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-gray-100"
                                title="Add topic"
                              >
                                <Plus size={15} />
                              </button>

                              {/* Merge Chapter */}
                              <button
                                type="button"
                                onClick={() => setMergeChapterModal(chapter)}
                                className="text-xs p-1 text-gray-500 hover:text-amber-600 rounded hover:bg-gray-100"
                                title="Merge this chapter into another"
                              >
                                <GitMerge size={15} />
                              </button>

                              {/* Delete Chapter */}
                              <button
                                type="button"
                                onClick={() => handleDeleteChapter(chapter)}
                                className="text-xs p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100"
                                title="Delete chapter"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Source Note Display if present */}
                          {chapter.source_note && (
                            <p className="text-xs text-gray-500 mt-1 italic pl-6">
                              Note: {chapter.source_note}
                            </p>
                          )}

                          {/* Topics List */}
                          {isChapterExpanded && (
                            <div className="pl-6 pt-3 space-y-2 border-t border-gray-100 mt-2">
                              {chapterTopics.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No topics defined yet.</p>
                              ) : (
                                chapterTopics.map(topic => {
                                  const topicSubtopics = subtopics.filter(st => st.topic_id === topic.id);

                                  return (
                                    <div
                                      key={topic.id}
                                      className="p-2 rounded bg-gray-50 border border-gray-100 flex flex-col gap-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                          <span className="font-medium text-xs text-gray-900">
                                            {topic.name}
                                          </span>
                                          <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                                            topic.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                          }`}>
                                            {topic.status}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {/* Add Subtopic */}
                                          <button
                                            type="button"
                                            onClick={() => setAddSubtopicModalTopic(topic)}
                                            className="p-0.5 text-gray-400 hover:text-indigo-600 text-xs"
                                            title="Add subtopic"
                                          >
                                            <Plus size={13} />
                                          </button>
                                          {/* Move Topic */}
                                          <button
                                            type="button"
                                            onClick={() => setMoveTopicModal(topic)}
                                            className="p-0.5 text-gray-400 hover:text-amber-600 text-xs"
                                            title="Move topic to another chapter"
                                          >
                                            <ArrowRightLeft size={13} />
                                          </button>
                                          {/* Delete Topic */}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTopic(topic)}
                                            className="p-0.5 text-gray-400 hover:text-red-600 text-xs"
                                            title="Delete topic"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Subtopics */}
                                      {topicSubtopics.length > 0 && (
                                        <div className="pl-4 pt-1 flex flex-wrap gap-1.5">
                                          {topicSubtopics.map(st => (
                                            <span
                                              key={st.id}
                                              className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-700"
                                            >
                                              {st.name}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  deleteSyllabusSubtopic(st.id);
                                                  loadData();
                                                }}
                                                className="text-gray-400 hover:text-red-500"
                                              >
                                                &times;
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModalChapter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleConfirmSyllabus}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <FileCheck className="text-indigo-600" size={18} />
              Confirm Syllabus Status
            </h3>
            <p className="text-xs text-gray-600">
              Confirming <strong>{confirmModalChapter.name}</strong> will set status to active and release it for student practice.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Source Note / Verification Reference:
              </label>
              <textarea
                value={confirmNote}
                onChange={e => setConfirmNote(e.target.value)}
                placeholder="e.g. Verified against NTA 2026 JEE Main Syllabus Section 4.2"
                rows={3}
                className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalChapter(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Confirm &amp; Activate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Topic Modal */}
      {addTopicModalChapter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddTopic}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 text-base">Add New Topic</h3>
            <p className="text-xs text-gray-600">
              Adding topic under chapter: <strong>{addTopicModalChapter.name}</strong>
            </p>
            <input
              type="text"
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              placeholder="Topic Name"
              className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              autoFocus
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddTopicModalChapter(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Topic
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Subtopic Modal */}
      {addSubtopicModalTopic && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddSubtopic}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 text-base">Add Subtopic</h3>
            <p className="text-xs text-gray-600">
              Under topic: <strong>{addSubtopicModalTopic.name}</strong>
            </p>
            <input
              type="text"
              value={newSubtopicName}
              onChange={e => setNewSubtopicName(e.target.value)}
              placeholder="Subtopic Name"
              className="w-full text-xs p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              autoFocus
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddSubtopicModalTopic(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Subtopic
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Merge Chapter Modal */}
      {mergeChapterModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleMergeChapterSubmit}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <GitMerge className="text-amber-600" size={18} />
              Merge Chapter
            </h3>
            <p className="text-xs text-gray-600">
              Merging <strong>{mergeChapterModal.name}</strong> will move all topics and questions into the selected chapter, register an alias, and remove the source.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Target Chapter (same subject):
              </label>
              <select
                value={targetChapterId}
                onChange={e => setTargetChapterId(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">-- Select Target Chapter --</option>
                {chapters
                  .filter(c => c.subject_id === mergeChapterModal.subject_id && c.id !== mergeChapterModal.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.external_id} — {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMergeChapterModal(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Execute Merge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move Topic Modal */}
      {moveTopicModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleMoveTopicSubmit}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <ArrowRightLeft className="text-indigo-600" size={18} />
              Move Topic
            </h3>
            <p className="text-xs text-gray-600">
              Moving topic <strong>{moveTopicModal.name}</strong> will update question references to the new chapter.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Destination Chapter:
              </label>
              <select
                value={moveTargetChapterId}
                onChange={e => setMoveTargetChapterId(e.target.value)}
                className="w-full text-xs p-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">-- Select Chapter --</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.external_id} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMoveTopicModal(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Move Topic
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

