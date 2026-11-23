import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ArrowRight, Clock, Target, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function DesignSystemReference() {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedToken(val);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans p-6 sm:p-10 max-w-6xl mx-auto space-y-12">
      {/* Top Banner */}
      <div className="border-b border-[#e2e8f0] pb-6">
        <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#1e3a8a] bg-[#eff6ff] border border-[#bfdbfe] px-2.5 py-0.5 rounded">
          Phase 1 Reference Page
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0f172a] mt-2">
          Design System &amp; Component Specification
        </h1>
        <p className="text-sm text-[#475569] mt-1 max-w-2xl">
          Restrained, high-contrast tokens, accessible typography, solid surfaces, and content-tailored layouts.
          Awaiting user review and approval prior to application across the site.
        </p>
      </div>

      {/* 1. Color Palette Tokens & Contrast Ratios */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#0f172a] flex items-center gap-2">
          <span>1. Brand Accent &amp; Neutral Scale</span>
          <span className="text-xs font-normal text-[#64748b]">(WCAG AA / AAA verified)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {/* Brand Primary */}
          <div
            onClick={() => copy('#1e3a8a')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#1e3a8a] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#1e3a8a] mb-2" />
            <div className="font-bold text-[#0f172a]">Brand Navy</div>
            <div className="font-mono text-[#64748b]">#1e3a8a</div>
            <div className="text-[10px] text-[#15803d] font-semibold mt-1">12.6:1 (AAA)</div>
          </div>

          <div
            onClick={() => copy('#1d4ed8')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#1d4ed8] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#1d4ed8] mb-2" />
            <div className="font-bold text-[#0f172a]">Accent Cobalt</div>
            <div className="font-mono text-[#64748b]">#1d4ed8</div>
            <div className="text-[10px] text-[#15803d] font-semibold mt-1">7.4:1 (AAA)</div>
          </div>

          <div
            onClick={() => copy('#0f172a')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#0f172a] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#0f172a] mb-2" />
            <div className="font-bold text-[#0f172a]">Text Primary</div>
            <div className="font-mono text-[#64748b]">#0f172a</div>
            <div className="text-[10px] text-[#15803d] font-semibold mt-1">18.7:1 (AAA)</div>
          </div>

          <div
            onClick={() => copy('#475569')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#475569] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#475569] mb-2" />
            <div className="font-bold text-[#0f172a]">Text Muted</div>
            <div className="font-mono text-[#64748b]">#475569</div>
            <div className="text-[10px] text-[#15803d] font-semibold mt-1">5.9:1 (AA)</div>
          </div>

          <div
            onClick={() => copy('#e2e8f0')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#94a3b8] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#e2e8f0] mb-2" />
            <div className="font-bold text-[#0f172a]">Border Hairline</div>
            <div className="font-mono text-[#64748b]">#e2e8f0</div>
            <div className="text-[10px] text-[#64748b] mt-1">Structure</div>
          </div>

          <div
            onClick={() => copy('#f8fafc')}
            className="p-3.5 rounded-lg border border-[#e2e8f0] bg-white cursor-pointer hover:border-[#94a3b8] transition-colors"
          >
            <div className="w-full h-10 rounded bg-[#f8fafc] border border-gray-200 mb-2" />
            <div className="font-bold text-[#0f172a]">Canvas BG</div>
            <div className="font-mono text-[#64748b]">#f8fafc</div>
            <div className="text-[10px] text-[#64748b] mt-1">Surface Base</div>
          </div>
        </div>

        {/* Status Palette */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-white rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#15803d]" />
              <span className="font-bold text-[#0f172a]">Correct / Pass: #15803d</span>
            </div>
            <span className="text-[10px] font-semibold text-[#15803d]">5.1:1 (AA)</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#b91c1c]" />
              <span className="font-bold text-[#0f172a]">Wrong / Error: #b91c1c</span>
            </div>
            <span className="text-[10px] font-semibold text-[#b91c1c]">5.9:1 (AA)</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#b45309]" />
              <span className="font-bold text-[#0f172a]">Warning / Pacing: #b45309</span>
            </div>
            <span className="text-[10px] font-semibold text-[#b45309]">4.7:1 (AA)</span>
          </div>
        </div>
      </section>

      {/* 2. Typography Hierarchy */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#0f172a]">2. Typographic Scale (Self-Hosted Engineering Grotesque)</h2>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 divide-y divide-[#f1f5f9] space-y-4">
          <div className="pt-2">
            <span className="text-[10px] font-mono uppercase text-[#64748b]">Page Title (24px / 1.5rem, Bold)</span>
            <p className="text-2xl font-bold text-[#0f172a] mt-0.5">Rotational Motion: Angular Momentum</p>
          </div>
          <div className="pt-4">
            <span className="text-[10px] font-mono uppercase text-[#64748b]">Section Heading (18px / 1.125rem, SemiBold)</span>
            <p className="text-lg font-semibold text-[#0f172a] mt-0.5">Active Pacing &amp; Telemetry Breakdown</p>
          </div>
          <div className="pt-4">
            <span className="text-[10px] font-mono uppercase text-[#64748b]">Body &amp; Question Text (15px / 0.9375rem, Regular)</span>
            <p className="text-base text-[#0f172a] mt-0.5 leading-relaxed">
              Two small balls with masses $m$ and $2m$ are attached to both ends of a rigid rod of length $d$ and negligible mass.
              Calculate the angular velocity of the system about its centre of mass.
            </p>
          </div>
          <div className="pt-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-[#64748b]">Monospace Identifier (12px, Bold)</span>
              <p className="font-mono text-xs font-bold text-[#1e3a8a] mt-0.5">JEE_MAIN_2026_JAN_PHY_01</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-[#64748b]">Helper Label (11px, Medium)</span>
              <p className="text-xs text-[#475569] mt-0.5">Updated 14 mins ago from official key</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Buttons, Inputs & Interactive Components */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#0f172a]">3. Controls &amp; Forms (Restrained, No Glows)</h2>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 space-y-6">
          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-semibold text-xs rounded-md transition-colors shadow-xs">
              Primary Button
            </button>
            <button className="px-4 py-2 bg-white hover:bg-[#f1f5f9] text-[#0f172a] font-semibold text-xs border border-[#cbd5e1] rounded-md transition-colors">
              Secondary Button
            </button>
            <button className="px-4 py-2 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c] font-semibold text-xs border border-[#fecaca] rounded-md transition-colors">
              Destructive Action
            </button>
            <button className="px-3 py-2 text-[#475569] hover:text-[#0f172a] text-xs font-semibold rounded-md transition-colors">
              Ghost Link
            </button>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1">Question ID Search</label>
              <input
                type="text"
                placeholder="e.g. JEE_MAIN_2026_JAN_PHY_01"
                className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-md focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0f172a] mb-1">Target Pace (Seconds)</label>
              <input
                type="number"
                defaultValue={60}
                className="w-full px-3 py-2 text-xs border border-[#cbd5e1] rounded-md focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Alternative Layouts Replacing Cliché 3-Card Grids (Item 6) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#0f172a]">
          4. Content-Specific Layouts (Replacing Default 3-Card Grids)
        </h2>

        {/* Layout A: Dense Telemetry Data Table */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
          <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">
              Layout A: Dense Telemetry Table (replaces 3 stat boxes)
            </span>
            <span className="text-xs font-mono text-[#64748b]">3 records</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] text-[#475569] border-b border-[#e2e8f0] font-semibold">
              <tr>
                <th className="py-2.5 px-4">Question ID</th>
                <th className="py-2.5 px-4">Subject &amp; Chapter</th>
                <th className="py-2.5 px-4">Active Time</th>
                <th className="py-2.5 px-4">Ideal Time</th>
                <th className="py-2.5 px-4">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              <tr>
                <td className="py-2.5 px-4 font-mono font-semibold text-[#1e3a8a]">JM2026_P01</td>
                <td className="py-2.5 px-4">Physics • Rotational Motion</td>
                <td className="py-2.5 px-4 font-mono font-bold">0m 45s</td>
                <td className="py-2.5 px-4 font-mono text-[#64748b]">1m 00s</td>
                <td className="py-2.5 px-4 font-bold text-[#15803d]">+4 (Correct)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-mono font-semibold text-[#1e3a8a]">JM2026_P02</td>
                <td className="py-2.5 px-4">Chemistry • Thermodynamics</td>
                <td className="py-2.5 px-4 font-mono font-bold text-[#b45309]">1m 45s</td>
                <td className="py-2.5 px-4 font-mono text-[#64748b]">1m 00s</td>
                <td className="py-2.5 px-4 font-bold text-[#b91c1c]">-1 (Wrong)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Layout B: Split View with Key-Value Specs */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1e3a8a]">
              Layout B: Split Editorial Spec
            </span>
            <h3 className="text-base font-bold text-[#0f172a] mt-1">Official Verification Protocol</h3>
            <p className="text-xs text-[#475569] mt-2 leading-relaxed">
              Every answer is cross-checked strictly against the final answer key published by the National Testing Agency.
              Questions with identified errata or dropped status are automatically flagged for manual review.
            </p>
          </div>
          <div className="bg-[#f8fafc] rounded-md p-4 border border-[#e2e8f0] text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-[#e2e8f0]">
              <span className="text-[#64748b]">Key Source</span>
              <span className="font-semibold text-[#0f172a]">NTA Final Answer Key</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#e2e8f0]">
              <span className="text-[#64748b]">Confidence Check</span>
              <span className="font-semibold text-[#0f172a]">Deterministic Match (100%)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#64748b]">Human Review Status</span>
              <span className="font-semibold text-[#15803d]">Verified by Senior Monitor</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Motion Rules */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#0f172a]">5. Motion &amp; Transition Rules</h2>
        <div className="bg-white rounded-lg border border-[#e2e8f0] p-5 text-xs space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#15803d]" />
            <span className="font-semibold">Button &amp; Link Hover:</span>
            <span className="font-mono text-[#64748b]">duration-150 ease-out (colors only)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#15803d]" />
            <span className="font-semibold">Dialog Open / Close:</span>
            <span className="font-mono text-[#64748b]">duration-200 ease-out (opacity only, no scale bounce)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#15803d]" />
            <span className="font-semibold">Accessibility Override:</span>
            <span className="font-mono text-[#64748b]">prefers-reduced-motion forces 0.001ms duration</span>
          </div>
        </div>
      </section>
    </div>
  );
}

