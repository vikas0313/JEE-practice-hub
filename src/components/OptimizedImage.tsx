import React, { useState } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: string; // e.g. "16/9", "4/3", "1/1"
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  aspectRatio = '16/9',
  className = '',
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ aspectRatio }}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-xs text-gray-400">Loading figure...</span>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-red-500">Figure could not be loaded</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...props}
        />
      )}
    </div>
  );
}

