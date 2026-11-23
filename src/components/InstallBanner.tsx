import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { shouldShowInstallBanner, dismissInstallBannerForever } from '../lib/pwa';
import { Download, X } from 'lucide-react';

interface InstallBannerProps {
  completedPracticesCount: number;
}

export function InstallBanner({ completedPracticesCount }: InstallBannerProps) {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Strictly forbid banner on exam routes or active exam sessions
    if (location.pathname.startsWith('/exam')) {
      setVisible(false);
      return;
    }

    setVisible(shouldShowInstallBanner(completedPracticesCount));
  }, [completedPracticesCount, location.pathname]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissInstallBannerForever();
    setVisible(false);
  };

  const handlePrompt = () => {
    // Advise user on how to install or trigger prompt if deferred event stored
    alert('To install Practice Hub: Tap the Share or menu button in your browser, then tap "Add to Home Screen".');
    handleDismiss();
  };

  return (
    <div
      role="region"
      aria-label="App Installation Prompt"
      className="fixed bottom-4 left-4 right-4 sm:hidden z-50 bg-indigo-900 text-white p-3.5 rounded-2xl shadow-xl border border-indigo-700/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-indigo-800 flex items-center justify-center shrink-0 text-amber-400">
          <Download size={18} />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-bold leading-tight truncate">Add to Home Screen</p>
          <p className="text-[11px] text-indigo-200 leading-tight">Faster practice & quick offline access</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handlePrompt}
          className="px-3 py-1.5 bg-amber-400 text-indigo-950 font-bold text-xs rounded-xl hover:bg-amber-300 transition-colors shadow-xs"
        >
          Add
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-indigo-300 hover:text-white rounded-lg"
          title="Don't show again"
          aria-label="Don't show again"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

