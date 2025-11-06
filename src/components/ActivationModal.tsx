import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Mail, FileText, Handshake, ShoppingCart } from 'lucide-react';
import { APP_VERSION } from '@/config/version';

interface ActivationModalProps {
  onSubmit: (email: string, activationCode: string) => void;
  onClose: () => void;
}

interface ContactInfo {
  type: 'business' | 'purchase';
  wechat: string | null;
  email: string | null;
}

interface TermsOfService {
  title: string;
  content: string;
  version: string;
}

const ActivationModal: React.FC<ActivationModalProps> = ({ onSubmit, onClose }) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contactInfo, setContactInfo] = useState<ContactInfo[]>([]);
  const [termsOfService, setTermsOfService] = useState<TermsOfService | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    // 加载联系信息
    fetch('/api/contact-info')
      .then(res => res.json())
      .then(result => {
        if (result.ok && result.data?.items) {
          setContactInfo(result.data.items);
        }
      })
      .catch(err => console.error('Failed to load contact info:', err));

    // 加载服务条款
    fetch('/api/terms-of-service')
      .then(res => res.json())
      .then(result => {
        if (result.ok && result.data) {
          setTermsOfService(result.data);
        }
      })
      .catch(err => console.error('Failed to load terms of service:', err));
  }, []);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板');
      });
    } else {
      // 兼容旧浏览器
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('已复制到剪贴板');
    }
  };

  const businessInfo = contactInfo.find(item => item.type === 'business');
  const purchaseInfo = contactInfo.find(item => item.type === 'purchase');

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
        <div className="text-center mb-4">
          <span className="text-xs text-gray-400">版本号: {APP_VERSION}</span>
        </div>
        
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

        {/* 联系信息区域 */}
        {(businessInfo || purchaseInfo) && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
            {businessInfo && (businessInfo.wechat || businessInfo.email) && (
              <div className="text-sm">
                <div className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-blue-600" />
                  商务合作请联系：
                </div>
                {businessInfo.wechat && (
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    <span
                      className="text-blue-600 underline cursor-pointer select-all"
                      onClick={() => copyToClipboard(businessInfo.wechat!)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        copyToClipboard(businessInfo.wechat!);
                      }}
                    >
                      {businessInfo.wechat}
                    </span>
                    <span className="text-xs text-gray-500">（长按复制）</span>
                  </div>
                )}
                {businessInfo.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span
                      className="text-blue-600 underline cursor-pointer select-all"
                      onClick={() => copyToClipboard(businessInfo.email!)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        copyToClipboard(businessInfo.email!);
                      }}
                    >
                      {businessInfo.email}
                    </span>
                    <span className="text-xs text-gray-500">（长按复制）</span>
                  </div>
                )}
              </div>
            )}

            {purchaseInfo && (purchaseInfo.wechat || purchaseInfo.email) && (
              <div className="text-sm">
                <div className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-600" />
                  激活码购买请联系：
                </div>
                {purchaseInfo.wechat && (
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="h-4 w-4 text-gray-500" />
                    <span
                      className="text-blue-600 underline cursor-pointer select-all"
                      onClick={() => copyToClipboard(purchaseInfo.wechat!)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        copyToClipboard(purchaseInfo.wechat!);
                      }}
                    >
                      {purchaseInfo.wechat}
                    </span>
                    <span className="text-xs text-gray-500">（长按复制）</span>
                  </div>
                )}
                {purchaseInfo.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span
                      className="text-blue-600 underline cursor-pointer select-all"
                      onClick={() => copyToClipboard(purchaseInfo.email!)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        copyToClipboard(purchaseInfo.email!);
                      }}
                    >
                      {purchaseInfo.email}
                    </span>
                    <span className="text-xs text-gray-500">（长按复制）</span>
                  </div>
                )}
              </div>
            )}

            {termsOfService && termsOfService.title && (
              <div className="text-sm">
                <button
                  onClick={() => setShowTerms(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  服务条款
                </button>
              </div>
            )}
          </div>
        )}

        {/* 管理员登录入口 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">管理员登录：</span>
            <input
              type="text"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入管理员代码"
            />
            <button
              onClick={() => {
                if (adminCode.toLowerCase() === 'zalem') {
                  router.push('/admin/login');
                } else {
                  alert('管理员代码错误');
                }
              }}
              className="px-4 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              登录
            </button>
          </div>
        </div>
      </div>

      {/* 服务条款弹窗 */}
      {showTerms && termsOfService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{termsOfService.title}</h3>
              <button
                onClick={() => setShowTerms(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {termsOfService.content}
            </div>
            {termsOfService.version && (
              <div className="mt-4 text-xs text-gray-500">
                版本：{termsOfService.version}
              </div>
            )}
            <button
              onClick={() => setShowTerms(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivationModal;