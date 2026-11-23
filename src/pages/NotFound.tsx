import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function NotFound() {
  const { user } = useAuth();
  const homePath = user?.role === 'monitor' ? '/monitor' : '/practice';

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const wasCreated = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const previousContent = meta.content;
    meta.content = 'noindex, nofollow';

    return () => {
      if (wasCreated) {
        meta?.remove();
      } else if (meta) {
        meta.content = previousContent;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
          <Compass size={48} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
        <p className="text-sm text-gray-500 mt-2 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to={homePath}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          <Home size={16} />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}

