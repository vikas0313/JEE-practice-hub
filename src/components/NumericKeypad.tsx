import React from 'react';
import { Delete, RotateCcw } from 'lucide-react';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowPhysicalKeypad?: boolean;
}

export function NumericKeypad({ value, onChange, disabled, allowPhysicalKeypad = true }: NumericKeypadProps) {
  const press = (char: string) => {
    if (disabled) return;
    // Don't allow multiple decimals or minus not at start
    if (char === '.' && value.includes('.')) return;
    if (char === '-' && value.length > 0) return;
    onChange(value + char);
  };

  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    if (disabled) return;
    onChange('');
  };

  const buttons = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', '.', '-'],
  ];

  const getButtonAriaLabel = (char: string) => {
    if (char === '.') return 'Decimal point';
    if (char === '-') return 'Minus sign';
    return `Digit ${char}`;
  };

  return (
    <div className="space-y-3 max-w-xs" role="region" aria-label="Numerical keypad">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => !disabled && allowPhysicalKeypad && onChange(e.target.value)}
          readOnly={!allowPhysicalKeypad}
          className={`w-full px-4 py-2.5 text-center text-xl font-mono font-semibold bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 shadow-inner ${
            !allowPhysicalKeypad ? 'cursor-default select-none' : ''
          }`}
          placeholder="0.00"
          disabled={disabled}
          aria-label="Numerical value answer"
          aria-describedby="nvq-keypad-instructions"
        />
        <div id="nvq-keypad-instructions" className="sr-only">
          Enter numerical response using the virtual numeric keypad buttons below or keyboard numbers if enabled.
        </div>
        {!allowPhysicalKeypad && (
          <span className="sr-only">Physical keyboard input disabled by NTA exam mode simulation. Use virtual keypad buttons.</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {buttons.flat().map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => press(char)}
            disabled={disabled}
            aria-label={getButtonAriaLabel(char)}
            className="py-3 bg-white border border-gray-200 rounded-lg text-lg font-mono font-medium text-gray-800 shadow-sm hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {char}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={backspace}
          disabled={disabled || value.length === 0}
          aria-label="Backspace"
          className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          <Delete size={16} /> Backspace
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || value.length === 0}
          aria-label="Clear answer"
          className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <RotateCcw size={16} /> Clear
        </button>
      </div>
    </div>
  );
}

