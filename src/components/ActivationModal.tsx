import React, { useState } from 'react';

interface ActivationModalProps {
  onSubmit: (email: string, activationCode: string) => void;
  onClose: () => void;
}

const ActivationModal: React.FC<ActivationModalProps> = ({ onSubmit, onClose }) => {
  const [email, setEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (!email || !activationCode) {
      setError('请填写邮箱和激活码');
      setLoading(false);
      return;
    }

    try {
      await onSubmit(email, activationCode);
    } catch (err: any) {
      setError(err.message || '激活失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-center mb-2">产品激活</h2>
        <p className="text-gray-600 text-center mb-6">请输入您的邮箱和激活码以激活产品</p>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@email.com"
              disabled={loading}
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="activationCode" className="block text-sm font-medium text-gray-700 mb-1">
              激活码
            </label>
            <input
              id="activationCode"
              type="text"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              disabled={loading}
              required
            />
          </div>

          <div className="flex space-x-3">
            {/* 移除了取消按钮，使用户无法跳过激活 */}
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? '激活中...' : '激活'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivationModal;