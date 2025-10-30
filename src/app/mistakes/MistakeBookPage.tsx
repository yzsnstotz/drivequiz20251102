"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trash2, BookOpen, Car, Shield, CheckSquare, XSquare } from 'lucide-react';

interface Question {
  id: number;
  type: 'single' | 'multiple' | 'truefalse';
  content: string;
  image?: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  fromExam?: boolean;
  fromStudy?: boolean;
  examId?: string;
  examTitle?: string;
  studySetId?: string;
  studySetTitle?: string;
}

function MistakeBookPage() {
  const [mistakeQuestions, setMistakeQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  useEffect(() => {
    loadMistakeQuestions();
  }, []);

  const loadMistakeQuestions = () => {
    const storedMistakes = localStorage.getItem('mistakeBook');
    if (storedMistakes) {
      setMistakeQuestions(JSON.parse(storedMistakes));
    } else {
      setMistakeQuestions([]);
    }
 };

  const removeMistakeQuestion = (questionId: number) => {
    const updatedMistakes = mistakeQuestions.filter(q => q.id !== questionId);
    setMistakeQuestions(updatedMistakes);
    localStorage.setItem('mistakeBook', JSON.stringify(updatedMistakes));
  };

 const clearAllMistakes = () => {
    setMistakeQuestions([]);
    localStorage.setItem('mistakeBook', '[]');
  };

  const getQuestionIcon = (question: Question) => {
    if (question.fromExam) {
      return <CheckSquare className="h-5 w-5 text-purple-600" />;
    } else if (question.content.includes('学科') || question.content.includes('讲习')) {
      return <BookOpen className="h-5 w-5 text-blue-600" />;
    } else if (question.content.includes('仮免')) {
      return <Car className="h-5 w-5 text-green-600" />;
    } else {
      return <Shield className="h-5 w-5 text-orange-600" />;
    }
  };

  const getQuestionTypeText = (type: string) => {
    switch (type) {
      case 'single': return '单选题';
      case 'multiple': return '多选题';
      case 'truefalse': return '判断题';
      default: return '题目';
    }
  };

  if (selectedQuestion) {
    return (
      <div className="container mx-auto px-4 py-6 pb-24">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setSelectedQuestion(null)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">错题详情</h1>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-blue-600">
                {getQuestionTypeText(selectedQuestion.type)}
              </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeMistakeQuestion(selectedQuestion.id);
              setSelectedQuestion(null); // 返回到错题列表页面
            }}
            className="flex items-center space-x-1 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm">移出错题本</span>
          </button>
            </div>
            
            <p className="text-gray-900 text-lg mb-4">{selectedQuestion.content}</p>
            {selectedQuestion.image && (
              <div className="mb-4">
                <img
                  src={selectedQuestion.image}
                  alt="题目图片"
                  className="max-w-full rounded-lg shadow-sm"
                />
              </div>
            )}
            
            {selectedQuestion.type === 'truefalse' ? (
              <div className="space-y-3">
                {['true', 'false'].map((option) => {
                  const isCorrect = selectedQuestion.correctAnswer === option;
                  const isSelected = selectedQuestion.correctAnswer === option;
                  
                  return (
                    <div
                      key={option}
                      className={`p-4 rounded-xl border-2 ${
                        isCorrect 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {option === 'true' ? '正确' : '错误'}
                      {isSelected && (
                        <span className="ml-2 text-green-600 font-medium">(正确答案)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedQuestion.options?.map((option, index) => {
                  const optionLabel = String.fromCharCode(65 + index);
                  const isCorrect = Array.isArray(selectedQuestion.correctAnswer)
                    ? selectedQuestion.correctAnswer.includes(optionLabel)
                    : selectedQuestion.correctAnswer === optionLabel;
                  
                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border-2 ${
                        isCorrect 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      {option}
                      {isCorrect && (
                        <span className="ml-2 text-green-600 font-medium">(正确答案)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedQuestion.explanation && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">解析</h3>
              <p className="text-blue-800">{selectedQuestion.explanation}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">错题本</h1>
        {mistakeQuestions.length > 0 && (
          <button
            onClick={clearAllMistakes}
            className="ml-auto text-red-600 hover:text-red-700 text-sm"
          >
            清空全部
          </button>
        )}
      </div>

      {mistakeQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无错题</h3>
          <p className="text-gray-600">在学习或模拟考试中答错的题目会自动保存到错题本</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mistakeQuestions.map((question, index) => (
            <div
              key={`${question.id}-${index}`}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedQuestion(question)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getQuestionIcon(question)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                      {index + 1}. {question.content}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMistakeQuestion(question.id);
                      }}
                      className="flex-shrink-0 text-gray-40 hover:text-red-600 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span>{getQuestionTypeText(question.type)}</span>
                    {question.fromExam && question.examTitle && (
                      <span className="bg-purple-10 text-purple-600 px-2 py-1 rounded-full">
                        {question.examTitle}
                      </span>
                    )}
                    {question.fromStudy && question.studySetTitle && (
                      <span className="bg-blue-10 text-blue-600 px-2 py-1 rounded-full">
                        {question.studySetTitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MistakeBookPage;
