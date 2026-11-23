// ============================================================
// Resource Links Management Console (Phase 6 M5: SRD Open Question 4)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  getResourceLinks, insertResourceLink, updateResourceLink, deleteResourceLink,
  getSubjects, getChapters, getTopics, getAllQuestions,
} from '../../lib/db';
import type { ResourceLink, ResourceType, Subject, Chapter, Topic, Question } from '../../lib/types';
import { Link2, Video, FileText, ExternalLink, HelpCircle, Plus, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function ResourceLinksPage() {
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('video');
  const [subjectId, setSubjectId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const [questionId, setQuestionId] = useState<string>('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLinks(getResourceLinks());
    setSubjects(getSubjects());
    setChapters(getChapters());
    setTopics(getTopics());
    setQuestions(getAllQuestions());
  };

  const handleStartCreate = () => {
    setIsEditing(true);
    setEditingId(null);
    setTitle('');
    setUrl('');
    setResourceType('video');
    setSubjectId('');
    setChapterId('');
    setTopicId('');
    setQuestionId('');
    setDisplayOrder(links.length);
    setError(null);
  };

  const handleStartEdit = (link: ResourceLink) => {
    setIsEditing(true);
    setEditingId(link.id);
    setTitle(link.title);
    setUrl(link.url);
    setResourceType(link.resource_type);
    setSubjectId(link.subject_id || '');
    setChapterId(link.chapter_id || '');
    setTopicId(link.topic_id || '');
    setQuestionId(link.question_id || '');
    setDisplayOrder(link.display_order);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    try {
      if (editingId) {
        updateResourceLink(editingId, {
          title: title.trim(),
          url: url.trim(),
          resource_type: resourceType,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          question_id: questionId || null,
          display_order: displayOrder,
        });
        setSuccess('Resource link updated successfully.');
      } else {
        insertResourceLink({
          id: crypto.randomUUID(),
          title: title.trim(),
          url: url.trim(),
          resource_type: resourceType,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          question_id: questionId || null,
          display_order: displayOrder,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setSuccess('Resource link created successfully.');
      }
      setIsEditing(false);
      setEditingId(null);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save resource link');
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this resource link?')) return;
    deleteResourceLink(id);
    setSuccess('Resource link deleted.');
    loadData();
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const current = links[index];
    const target = links[targetIndex];

    updateResourceLink(current.id, { display_order: target.display_order });
    updateResourceLink(target.id, { display_order: current.display_order });

    loadData();
  };

  // Filter chapters based on selected subject
  const availableChapters = subjectId
    ? chapters.filter(c => c.subject_id === subjectId)
    : chapters;

  // Filter topics based on selected chapter
  const availableTopics = chapterId
    ? topics.filter(t => t.chapter_id === chapterId)
    : topics;

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'video':
        return <Video size={16} className="text-red-600" />;
      case 'notes':
        return <FileText size={16} className="text-emerald-600" />;
      case 'solution':
        return <HelpCircle size={16} className="text-blue-600" />;
      default:
        return <ExternalLink size={16} className="text-purple-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="text-indigo-600" />
            Curated Resource Links
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Curate verified concept videos, concise summary notes, and external solutions attached to topics, chapters, or questions.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Resource Link
          </button>
        )}
      </div>

      {/* Info notice about active exam shielding */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex items-start gap-3">
        <ExternalLink size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Automatic Exam Shield:</strong> Resource links are shown to the student in Practice Mode and the Mistake Notebook. When the student has an active Computer-Based Test (CBT) exam containing a question, all resource links for that question, topic, and chapter are strictly withheld to preserve strict exam integrity.
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Dismiss</button>
        </div>
      )}

      {/* Create / Edit Form */}
      {isEditing && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Resource Link' : 'Add New Resource Link'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. 3Blue1Brown: Essence of Calculus Ch 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resource Type
                </label>
                <select
                  value={resourceType}
                  onChange={e => setResourceType(e.target.value as ResourceType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="video">Video Lecture / Explanation</option>
                  <option value="notes">Concept Notes / Summary</option>
                  <option value="solution">Alternative Solution</option>
                  <option value="external">External Reference / Article</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={e => setDisplayOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Scope selectors */}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Scope Association (Optional)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Attach this resource to a specific Subject, Chapter, Topic, or Question. Leaving them empty makes it a general resource.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <select
                    value={subjectId}
                    onChange={e => {
                      setSubjectId(e.target.value);
                      setChapterId('');
                      setTopicId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  >
                    <option value="">-- All Subjects --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chapter</label>
                  <select
                    value={chapterId}
                    onChange={e => {
                      setChapterId(e.target.value);
                      setTopicId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  >
                    <option value="">-- All Chapters --</option>
                    {availableChapters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                  <select
                    value={topicId}
                    onChange={e => setTopicId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  >
                    <option value="">-- All Topics --</option>
                    {availableTopics.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Question ID (Specific)</label>
                  <input
                    type="text"
                    value={questionId}
                    onChange={e => setQuestionId(e.target.value)}
                    placeholder="UUID or leave blank"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium shadow-sm"
              >
                {editingId ? 'Save Changes' : 'Create Resource Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Links List Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {links.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Link2 size={36} className="mx-auto text-gray-400 mb-3" />
            <p className="font-semibold text-gray-700">No resource links added yet.</p>
            <p className="text-sm mt-1">Add curated video explanations, formula cheat sheets, or notes for the student.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Title & URL</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Associated Scope</th>
                  <th className="py-3 px-4 text-center">Order</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {links.map((link, idx) => {
                  const subject = subjects.find(s => s.id === link.subject_id);
                  const chapter = chapters.find(c => c.id === link.chapter_id);
                  const topic = topics.find(t => t.id === link.topic_id);
                  const question = link.question_id ? questions.find(q => q.id === link.question_id) : null;

                  return (
                    <tr key={link.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-center font-mono text-xs text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{link.title}</div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 mt-0.5 break-all"
                        >
                          {link.url}
                          <ExternalLink size={12} className="inline shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {getTypeIcon(link.resource_type)}
                          {link.resource_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {question && (
                          <div className="font-medium text-blue-800">Q#{question.number} (Paper: {question.paper_id.slice(0, 8)})</div>
                        )}
                        {topic && (
                          <div className="text-gray-700">Topic: {topic.name}</div>
                        )}
                        {chapter && (
                          <div className="text-gray-500">Chapter: {chapter.name}</div>
                        )}
                        {subject && (
                          <div className="text-gray-400">Subject: {subject.name}</div>
                        )}
                        {!question && !topic && !chapter && !subject && (
                          <span className="text-gray-400 italic">General / Global</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleMoveOrder(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <span className="font-mono text-xs text-gray-600">{link.display_order}</span>
                          <button
                            onClick={() => handleMoveOrder(idx, 'down')}
                            disabled={idx === links.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(link)}
                            className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-gray-100"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(link.id)}
                            className="p-1 text-gray-500 hover:text-red-600 rounded hover:bg-gray-100"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

