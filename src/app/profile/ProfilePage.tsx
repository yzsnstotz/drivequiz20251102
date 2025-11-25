'use client';

import React, { useState, useEffect } from 'react';
import { User, XSquare, Settings, Edit2, Trophy, BookOpen, Star } from 'lucide-react';
import Link from 'next/link';
import { getLocalPackageVersion } from '@/lib/questionsLoader';
import { useLanguage } from '@/lib/i18n';

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
  const { t } = useLanguage();
  const [nickname, setNickname] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [examHistory, setExamHistory] = useState<ExamHistory[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistory[]>([]);
  const [pkgVersion, setPkgVersion] = useState<string | null>(null);

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

    // 读取当前本地题库版本号（用于测试校对显示）
    try {
      const v = getLocalPackageVersion();
      setPkgVersion(v);
    } catch {
      setPkgVersion(null);
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

  const handleClearActivation = () => {
    if (confirm(t('profile.clearActivationConfirm'))) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('drive-quiz-activated');
        localStorage.removeItem('drive-quiz-email');
        alert(t('profile.clearActivationSuccess'));
        window.location.reload();
      }
    }
  };

  const menuItems = [
    {
      id: 'mistakes',
      icon: <XSquare className="h-6 w-6 text-red-60" />,
      title: t('profile.mistakes'),
      description: t('profile.mistakesDesc'),
      href: '/mistakes'
    },
    {
      id: 'favorites',
      icon: <Star className="h-6 w-6 text-yellow-600 fill-current" />,
      title: t('profile.favorites'),
      description: t('profile.favoritesDesc'),
      href: '/favorites'
    },
    {
      id: 'exam-history',
      icon: <Trophy className="h-6 w-6 text-yellow-600" />,
      title: t('profile.examHistory'),
      description: t('profile.examHistoryDesc'),
      onClick: () => document.getElementById('exam-history-section')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 'practice-history',
      icon: <BookOpen className="h-6 w-6 text-blue-60" />,
      title: t('profile.practiceHistory'),
      description: t('profile.practiceHistoryDesc'),
      onClick: () => document.getElementById('practice-history-section')?.scrollIntoView({ behavior: 'smooth' })
    },
    {
      id: 'clear-activation',
      icon: <XSquare className="h-6 w-6 text-red-600" />,
      title: t('profile.clearActivation'),
      description: t('profile.clearActivationDesc'),
      onClick: handleClearActivation,
      isDanger: true
    },
    {
      id: 'settings',
      icon: <Settings className="h-6 w-6 text-gray-600" />,
      title: t('profile.settings'),
      description: t('profile.settingsDesc')
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
          {/* 本地题库版本展示 */}
          <div className="mt-2 text-xs text-gray-500">
            {t('profile.questionBankVersion')}：{pkgVersion ? pkgVersion : t('profile.questionBankVersionUnknown')}
          </div>
        </div>
      </div>

      {/* 功能菜单区域 */}
      <div className="space-y-4 mb-6">
        {menuItems.map((item) => {
          // 如果有 href，使用 Link 组件
          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="block"
              >
                <div className={`bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4 cursor-pointer transition-colors ${
                  item.isDanger ? 'hover:bg-red-50' : 'hover:bg-gray-50'
                }`}>
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-grow">
                    <h3 className={`font-medium ${
                      item.isDanger ? 'text-red-600' : 'text-gray-900'
                    }`}>{item.title}</h3>
                    <p className="text-gray-500 text-sm">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          }
          
          // 如果没有 href，使用 div 并执行 onClick
          return (
            <div
              key={item.id}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                }
              }}
              className="block"
            >
              <div className={`bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4 cursor-pointer transition-colors ${
                item.isDanger ? 'hover:bg-red-50' : 'hover:bg-gray-50'
              }`}>
                <div className="flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-grow">
                  <h3 className={`font-medium ${
                    item.isDanger ? 'text-red-600' : 'text-gray-900'
                  }`}>{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 考试历史区域 */}
      <div id="exam-history-section" className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-bold text-gray-90">{t('profile.examHistory')}</h3>
        </div>
        
        {examHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('profile.noExamHistory')}</p>
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
          <h3 className="text-lg font-bold text-gray-900">{t('profile.practiceHistoryTitle')}</h3>
        </div>
        
        {practiceHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('profile.noPracticeHistory')}</p>
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
                      {item.correct ? t('profile.correct') : t('profile.incorrect')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.from === 'exam' ? t('profile.fromExam') : t('profile.fromStudy')}
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
