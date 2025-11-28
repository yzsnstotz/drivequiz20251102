import React from 'react';
import { useLanguage } from '@/lib/i18n';

interface SuccessModalProps {
  isOpen: boolean;
  expiresAt: string | null;
  onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, expiresAt, onClose }) => {
  const { t, language } = useLanguage();
  
  if (!isOpen) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('activation.success.noExpiry');
    try {
      const date = new Date(dateString);
      const localeMap: Record<string, string> = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'ja': 'ja-JP',
      };
      return date.toLocaleString(localeMap[language] || 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('activation.success.title')}</h2>
          <p className="text-gray-600 mb-4">{t('activation.success.message')}</p>
          {expiresAt && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">{t('activation.success.expiresAt')}</p>
              <p className="text-lg font-semibold text-blue-600">{formatDate(expiresAt)}</p>
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;

