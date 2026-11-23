import React, { useState, useEffect } from 'react';
import {
  getApprovedStudents,
  getActiveSelectedStudentId,
  setActiveSelectedStudentId,
  getStudentProfile,
} from '../lib/db';
import type { Profile } from '../lib/types';
import { User, ChevronDown } from 'lucide-react';

export function StudentSelector() {
  const [approvedStudents, setApprovedStudents] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => {
    const list = getApprovedStudents();
    setApprovedStudents(list);
    const active = getActiveSelectedStudentId();
    if (active && list.some(s => s.id === active)) {
      setSelectedId(active);
    } else if (list.length > 0) {
      const chosen = list[list.length - 1].id;
      setSelectedId(chosen);
      setActiveSelectedStudentId(chosen);
    } else {
      setSelectedId(null);
    }
  };

  useEffect(() => {
    refresh();
    const handleStorage = () => refresh();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('active-student-changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('active-student-changed', handleStorage);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedId(newId);
    setActiveSelectedStudentId(newId);
    window.dispatchEvent(new Event('active-student-changed'));
    window.dispatchEvent(new Event('storage'));
  };

  if (approvedStudents.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-800/60 text-indigo-200 text-xs rounded-lg border border-indigo-700/50">
        <User size={13} />
        <span>No approved students</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-indigo-800/80 hover:bg-indigo-800 text-white px-2.5 py-1 rounded-lg border border-indigo-600 transition-colors">
      <User size={14} className="text-indigo-200 shrink-0" />
      <span className="text-xs text-indigo-200 font-medium hidden md:inline">Viewing:</span>
      <select
        value={selectedId || ''}
        onChange={handleChange}
        aria-label="Select student to monitor"
        className="bg-transparent text-xs font-semibold text-white outline-none cursor-pointer pr-1"
      >
        {approvedStudents.map(s => {
          const displayName = `${s.first_name || s.name || 'Student'} ${s.last_name || ''}`.trim();
          const college = s.college_name ? ` (${s.college_name})` : '';
          return (
            <option key={s.id} value={s.id} className="text-gray-900 bg-white">
              {displayName} {college}
            </option>
          );
        })}
      </select>
    </div>
  );
}
