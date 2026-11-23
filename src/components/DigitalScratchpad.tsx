// ============================================================
// Module G3: Practice Digital Scratchpad Component
// Stylus / finger canvas drawing for tablet users in Practice mode.
// Strict compliance: Never transmits drawing data to server.
// Strictly excluded from CBT Exam mode (NTA physical paper compliance).
// ============================================================

import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Eraser, RotateCcw, Trash2, ChevronDown, ChevronUp, Palette } from 'lucide-react';

interface DigitalScratchpadProps {
  onClose?: () => void;
}

export function DigitalScratchpad({ onClose }: DigitalScratchpadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokeColor, setStrokeColor] = useState<string>('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const historyRef = useRef<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, [isCollapsed]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (historyRef.current.length >= 20) {
      historyRef.current.shift();
    }
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyRef.current.pop(); // Remove current state
    const prevState = historyRef.current[historyRef.current.length - 1];
    ctx.putImageData(prevState, 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : strokeColor;

    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  return (
    <div className="border border-indigo-200 bg-white rounded-2xl shadow-md overflow-hidden transition-all my-4">
      {/* Scratchpad Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <PenTool size={16} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
            Practice Scratchpad (Tablet / Stylus)
          </span>
          <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">
            Local Only
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-indigo-100 rounded text-indigo-700 transition"
            aria-label={isCollapsed ? 'Expand scratchpad' : 'Collapse scratchpad'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-2 p-3">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition ${
                  tool === 'pen'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <PenTool size={13} />
                <span>Pen</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`p-1.5 rounded-lg flex items-center gap-1 font-semibold transition ${
                  tool === 'eraser'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Eraser size={13} />
                <span>Eraser</span>
              </button>

              {tool === 'pen' && (
                <div className="flex items-center gap-1 pl-2">
                  {['#1e293b', '#2563eb', '#dc2626', '#16a34a'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStrokeColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition ${
                        strokeColor === c ? 'border-indigo-600 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-1 font-semibold transition"
                title="Undo last stroke"
              >
                <RotateCcw size={13} />
                <span>Undo</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg flex items-center gap-1 font-semibold transition"
                title="Clear canvas"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Drawing Canvas */}
          <div className="w-full h-44 border border-gray-200 rounded-xl overflow-hidden touch-none bg-white">
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              className="w-full h-full cursor-crosshair"
            />
          </div>
        </div>
      )}
    </div>
  );
}

