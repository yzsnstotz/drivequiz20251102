import React, { useState, useEffect } from 'react';
import { User, History, XSquare, Settings, Edit2 } from 'lucide-react';

function ProfilePage() {
  const [nickname, setNickname] = useState('用户');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    // 从 localStorage 加载用户昵称
    const savedNickname = localStorage.getItem('user_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  const handleEditClick = () => {
    setEditValue(nickname);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue.trim()) {
      setNickname(editValue.trim());
      localStorage.setItem('user_nickname', editValue.trim());
    }
    setIsEditing(false);
  };

  const menuItems = [
    {
      id: 'history',
      icon: <History className="h-6 w-6 text-blue-600" />,
      title: '做题历史',
      description: '查看你的学习记录'
    },
    {
      id: 'mistakes',
      icon: <XSquare className="h-6 w-6 text-red-600" />,
      title: '错题库',
      description: '复习错误的题目'
    },
    {
      id: 'settings',
      icon: <Settings className="h-6 w-6 text-gray-600" />,
      title: '设置',
      description: '偏好设置'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 用户信息区域 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-gray-400" />
          </div>
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onBlur={handleSave}
                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          ) : (
            <div 
              onClick={handleEditClick}
              className="flex items-center space-x-2 cursor-pointer group"
            >
              <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600">
                {nickname}
              </h2>
              <Edit2 className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
            </div>
          )}
        </div>
      </div>

      {/* 功能菜单区域 */}
      <div className="space-y-4">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex-shrink-0">
              {item.icon}
            </div>
            <div className="flex-grow">
              <h3 className="text-gray-900 font-medium">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProfilePage;