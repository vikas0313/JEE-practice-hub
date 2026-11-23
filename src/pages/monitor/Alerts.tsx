// ============================================================
// Alerts Center & Notification Settings (Phase 3: SRD FR-8.1, Section 8)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  getAlerts, acknowledgeAlert, resolveAlert, getAlertSettings,
  updateAlertSettings,
} from '../../lib/db';
import { evaluateAlerts } from '../../lib/alertsEngine';
import { generateWeeklyDigest, sendWeeklySummaryEmail } from '../../lib/emailService';
import { sanitizeHtml } from '../../lib/contentSafety';
import type { Alert, AlertSettings } from '../../lib/types';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');
  const [settings, setSettings] = useState<AlertSettings>(getAlertSettings());
  const [message, setMessage] = useState<string | null>(null);

  // Email digest preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = () => {
    setAlerts(getAlerts());
    setSettings(getAlertSettings());
  };

  const handleEvaluate = () => {
    const res = evaluateAlerts();
    loadAlerts();
    setMessage(`Evaluated rules: ${res.generated.length} alerts generated, ${res.resolved.length} auto-resolved.`);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeAlert(id);
    loadAlerts();
  };

  const handleResolve = (id: string) => {
    resolveAlert(id);
    loadAlerts();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateAlertSettings(settings);
    setMessage('Notification settings updated!');
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePreviewEmail = () => {
    const digest = generateWeeklyDigest();
    setPreviewHtml(sanitizeHtml(digest.html));
    setPreviewOpen(true);
  };

  const handleSendTestEmail = async () => {
    const res = await sendWeeklySummaryEmail({ forceTest: true });
    setMessage(res.message);
    setTimeout(() => setMessage(null), 4000);
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'active') return a.status === 'active' || a.status === 'acknowledged';
    if (filter === 'resolved') return a.status === 'resolved';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts Center & Notification Settings</h1>
          <p className="text-sm text-gray-600">
            Monitor real-time alerts (inactivity, sudden accuracy drops, exam terminations) and manage weekly digests.
          </p>
        </div>
        <button
          onClick={handleEvaluate}
          className="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          ⚡ Evaluate Alerts Now
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Main Grid: Alerts List & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-900">Alerts Inbox ({filteredAlerts.length})</h3>
            <div className="flex space-x-1">
              {(['active', 'resolved', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize ${
                    filter === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="bg-white border rounded-xl p-8 text-center text-gray-500 text-sm">
              No alerts found in this view.
            </div>
          ) : (
            filteredAlerts.map(a => {
              let badgeColor = 'bg-blue-100 text-blue-800';
              if (a.severity === 'warning') badgeColor = 'bg-amber-100 text-amber-800';
              if (a.severity === 'critical') badgeColor = 'bg-rose-100 text-rose-800';

              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${badgeColor}`}>
                        {a.severity}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">{a.title}</h4>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 leading-relaxed">{a.message}</p>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <div className="text-gray-400">
                      Status: <strong className="text-gray-700 capitalize">{a.status}</strong>
                      {a.cooldown_until && (
                        <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Cooldown active
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {a.status === 'active' && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          className="px-2.5 py-1 text-xs border rounded text-gray-600 hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolve(a.id)}
                          className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 font-semibold rounded hover:bg-emerald-100"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Settings & Digest Controls Column */}
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm border-b pb-2">Trigger Thresholds</h3>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Inactivity Warning (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.inactivity_days}
                onChange={e => setSettings({ ...settings, inactivity_days: parseInt(e.target.value, 10) })}
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Accuracy Drop Threshold (%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="0.50"
                value={settings.accuracy_drop_threshold}
                onChange={e => setSettings({ ...settings, accuracy_drop_threshold: parseFloat(e.target.value) })}
                className="w-full p-2 border rounded text-sm"
              />
              <span className="text-[10px] text-gray-400">e.g. 0.15 = 15% drop triggers alert</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Monitor Recipient Email
              </label>
              <input
                type="email"
                value={settings.monitor_email || ''}
                onChange={e => setSettings({ ...settings, monitor_email: e.target.value })}
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="email_toggle"
                checked={settings.email_alerts_enabled}
                onChange={e => setSettings({ ...settings, email_alerts_enabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="email_toggle" className="text-xs text-gray-700 font-medium">
                Deliver alerts via Email
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition"
            >
              Save Alert Settings
            </button>
          </form>

          {/* Weekly Digest Box */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-3">
            <h4 className="font-bold text-indigo-950 text-sm">Weekly Summary Digest</h4>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Automated weekly summary containing practice volume, subject accuracy, active assignments, and chance-of-target ranges.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handlePreviewEmail}
                className="w-full py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-50 transition"
              >
                Preview Email Digest
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                className="w-full py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition"
              >
                Send Test Email Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900">Email Digest Preview</h3>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="border rounded-xl p-4 bg-gray-50" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-5 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
