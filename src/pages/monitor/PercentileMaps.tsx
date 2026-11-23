// ============================================================
// Percentile Maps Importer & Editor (Phase 3: SRD FR-10.3, Section 6.1)
// Shift-specific marks-to-percentile reference tables
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  getPercentileMaps, getPercentileMapRows, createPercentileMap,
  deletePercentileMap,
} from '../../lib/db';
import type { PercentileMap, PercentileMapRow } from '../../lib/types';

export default function PercentileMapsPage() {
  const [maps, setMaps] = useState<PercentileMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [rows, setRows] = useState<PercentileMapRow[]>([]);

  // Importer form
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [year, setYear] = useState(2026);
  const [shift, setShift] = useState('Jan 28 Morning');
  const [source, setSource] = useState('NTA Official');
  const [isApproximation, setIsApproximation] = useState(false);
  const [csvContent, setCsvContent] = useState(
`marks,percentile
300,100.0000
280,99.9500
250,99.6000
220,99.1000
190,97.8000
160,95.5000
130,90.5000
100,81.0000
70,66.0000
40,46.0000
0,0.0000`
  );

  useEffect(() => {
    loadMaps();
  }, []);

  useEffect(() => {
    if (selectedMapId) {
      setRows(getPercentileMapRows(selectedMapId));
    } else {
      setRows([]);
    }
  }, [selectedMapId]);

  const loadMaps = () => {
    const list = getPercentileMaps();
    setMaps(list);
    if (list.length > 0 && !selectedMapId) {
      setSelectedMapId(list[0].id);
    }
  };

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Parse CSV
    const parsedRows: Array<{ marks: number; percentile: number }> = [];
    const lines = csvContent.trim().split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.toLowerCase().startsWith('marks')) continue;
      const parts = line.split(',');
      if (parts.length >= 2) {
        const m = parseFloat(parts[0]);
        const p = parseFloat(parts[1]);
        if (!isNaN(m) && !isNaN(p)) {
          parsedRows.push({ marks: m, percentile: p });
        }
      }
    }

    if (parsedRows.length === 0) {
      alert('Could not parse any valid marks,percentile rows from CSV.');
      return;
    }

    const created = createPercentileMap(
      {
        name: name.trim(),
        year: Number(year),
        shift: shift.trim(),
        source: source.trim(),
        is_approximation: isApproximation,
      },
      parsedRows
    );

    setIsAdding(false);
    setName('');
    loadMaps();
    setSelectedMapId(created.id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this percentile map?')) {
      deletePercentileMap(id);
      loadMaps();
      setSelectedMapId(null);
    }
  };

  const selectedMap = maps.find(m => m.id === selectedMapId);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marks-to-Percentile Maps (Shift Data)</h1>
          <p className="text-sm text-gray-600">
            Shift-specific empirical curves for Bayesian projection. Maps not official are flagged as approximations.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          {isAdding ? 'Cancel' : '+ Import Shift Map (CSV)'}
        </button>
      </div>

      {/* Importer Modal */}
      {isAdding && (
        <form onSubmit={handleImport} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Import Marks-to-Percentile Map</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Map Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 2026 Shift 1 Morning"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Year</label>
              <input
                type="number"
                required
                value={year}
                onChange={e => setYear(parseInt(e.target.value, 10))}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Shift / Session</label>
              <input
                type="text"
                required
                value={shift}
                onChange={e => setShift(e.target.value)}
                placeholder="e.g. Jan 28 Morning"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Source</label>
              <input
                type="text"
                required
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. NTA Official / Coaching Analysis"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="is_approx"
              checked={isApproximation}
              onChange={e => setIsApproximation(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <label htmlFor="is_approx" className="text-sm text-gray-700 font-medium">
              Flag as approximation (if not official NTA table)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              CSV Data (marks,percentile)
            </label>
            <textarea
              rows={8}
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
              className="w-full p-3 font-mono text-xs border rounded-lg"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Save Map
            </button>
          </div>
        </form>
      )}

      {/* Main Layout: List & Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Map List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Available Maps</h3>
          {maps.map(m => (
            <div
              key={m.id}
              onClick={() => setSelectedMapId(m.id)}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                selectedMapId === m.id
                  ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm text-gray-900">{m.name}</h4>
                {m.is_approximation && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                    Approx
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {m.shift} • {m.year}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                <span>Source: {m.source}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                  className="text-rose-600 hover:text-rose-800 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Map Curve Table */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {selectedMap ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{selectedMap.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedMap.source} • {rows.length} calibration anchor points
                  </p>
                </div>
                {selectedMap.is_approximation && (
                  <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full font-medium">
                    Approximation Map
                  </span>
                )}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      <th className="p-3">Marks (out of 300)</th>
                      <th className="p-3">Percentile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50/50">
                        <td className="p-3 font-semibold text-gray-900">{r.marks}</td>
                        <td className="p-3 text-indigo-700 font-bold">{r.percentile.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">
              Select or import a percentile map to inspect marks-to-percentile curves.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
