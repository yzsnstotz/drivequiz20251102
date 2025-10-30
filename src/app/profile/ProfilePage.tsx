'use client';

import React, { useState, useEffect } from 'react';
import { User, XSquare, Settings, Edit2, Trophy, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface ExamHistory {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  date: string;
  timeSpent: number; // in seconds
}

interface PracticeHistory {
  id: string;
  questionId: number;
  content: string;
 type: string;
 correct: boolean;
 date: string;
 from: string; // 'exam' or 'study'
}

function ProfilePage() {
  const [nickname, setNickname] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [examHistory, setExamHistory] = useState<ExamHistory[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistory[]>([]);

  useEffect(() => {
    // 从 localStorage 加载用户昵称
    const savedNickname = localStorage.getItem('user_nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }

    // 加载考试历史
    const savedExamHistory = localStorage.getItem('examHistory');
    if (savedExamHistory) {
      setExamHistory(JSON.parse(savedExamHistory));
    }

    // 加载做题历史（最近50题）
    const savedPracticeHistory = localStorage.getItem('practiceHistory');
    if (savedPracticeHistory) {
      const allHistory = JSON.parse(savedPracticeHistory);
      // 只保留最近50题
      const recentHistory = allHistory.slice(-50);
      setPracticeHistory(recentHistory);
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
      id: 'mistakes',
      icon: <XSquare className="h-6 w-6 text-red-60" />,
      title: '错题本',
      description: '复习错误的题目',
      href: '/mistakes'
    },
    {
      id: 'exam-history',
      icon: <Trophy className="h-6 w-6 text-yellow-600" />,
      title: '考试历史',
      description: '查看考试成绩记录',
      onClick: () => document.getElementById('exam-history-section')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 'practice-history',
      icon: <BookOpen className="h-6 w-6 text-blue-60" />,
      title: '做题历史',
      description: '查看最近50题记录',
      onClick: () => document.getElementById('practice-history-section')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 'settings',
      icon: <Settings className="h-6 w-6 text-gray-600" />,
      title: '设置',
      description: '偏好设置'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      {/* 用户信息区域 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-gray-40" />
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
      <div className="space-y-4 mb-6">
        {menuItems.map((item) => (
          <Link
            key={item.id}
            href={item.href || '#'}
            onClick={(e) => {
              if (item.href) {
                // 如果有href，让Link组件处理导航
                return;
              }
              // 如果没有href，阻止默认行为并执行onClick
              e.preventDefault();
              if (item.onClick) {
                item.onClick();
              }
            }}
            className="block"
          >
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              <div className="flex-grow">
                <h3 className="text-gray-900 font-medium">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 考试历史区域 */}
      <div id="exam-history-section" className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-bold text-gray-90">考试历史</h3>
        </div>
        
        {examHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无考试记录</p>
        ) : (
          <div className="space-y-3">
            {examHistory.slice(-5).reverse().map((exam, index) => (
              <div key={index} className="border-b border-gray-100 pb-3 last:border-b-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">{exam.title}</h4>
                    <p className="text-xs text-gray-500">{exam.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-blue-600">
                      {Math.round((exam.score / exam.totalQuestions) * 10)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {exam.score}/{exam.totalQuestions}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 做题历史区域 */}
      <div id="practice-history-section" className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">做题历史（最近50题）</h3>
        </div>
        
        {practiceHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无做题记录</p>
        ) : (
          <div className="space-y-3">
            {practiceHistory.slice(-20).reverse().map((item, index) => (
              <div key={index} className="border-b border-gray-100 pb-3 last:border-b-0">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 line-clamp-1">{item.content}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      item.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.correct ? '正确' : '错误'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.from === 'exam' ? '考试' : '学习'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
