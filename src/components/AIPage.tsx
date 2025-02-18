import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface AIPageProps {
  onBack: () => void;
}

const AIPage: React.FC<AIPageProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Array<{type: 'user' | 'ai', content: string}>>([{
    type: 'ai',
    content: '你好！我是你的AI助手，有什么我可以帮你的吗？'
  }]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: input
    }]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white p-4 border-b flex items-center space-x-4">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">AI助手</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-white shadow-md'}`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 bg-white border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入你的问题..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIPage;