"use client";

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface QuestionImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  sizes?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  useNativeImg?: boolean; // 是否使用原生 img 标签
}

export default function QuestionImage({
  src,
  alt = '题目图片',
  width,
  height,
  className = '',
  fill = false,
  sizes,
  objectFit = 'contain',
  useNativeImg = false,
}: QuestionImageProps) {
  const { t } = useLanguage();
  const [imageError, setImageError] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    setImageError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setImageError(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setImageError(false);
    setIsLoading(true);
    setImageKey(prev => prev + 1);
  }, []);

  if (imageError) {
    return (
      <div className={`mb-4 relative ${className}`}>
        <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-ios-dark-bg-tertiary rounded-lg p-8 min-h-[200px]">
          <div className="text-gray-400 dark:text-gray-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t('question.imageLoadError')}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label={t('common.refresh')}
          >
            <RefreshCw className="h-4 w-4" />
            <span>{t('common.refresh')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-ios-dark-bg-tertiary rounded-lg z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      )}
      {useNativeImg ? (
        <img
          key={imageKey}
          src={src.trim()}
          alt={alt}
          className={`w-full max-w-md mx-auto rounded-lg ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      ) : fill ? (
        <Image
          key={imageKey}
          src={src.trim()}
          alt={alt}
          fill
          sizes={sizes}
          className={`${objectFit === 'contain' ? 'object-contain' : objectFit === 'cover' ? 'object-cover' : ''} rounded-lg shadow-sm ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      ) : (
        <Image
          key={imageKey}
          src={src.trim()}
          alt={alt}
          width={width || 800}
          height={height || 600}
          className={`max-w-full rounded-lg shadow-sm ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity'}`}
          onError={handleError}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}

