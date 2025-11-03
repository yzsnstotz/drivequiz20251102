"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';

type Merchant = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
};

type MerchantCategory = {
  id: number;
  name: string;
  displayOrder: number;
};

function NearbyPage() {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载商户类型
      const categoryRes = await fetch('/api/merchant-categories');
      if (categoryRes.ok) {
        const categoryData = await categoryRes.json();
        if (categoryData.ok) {
          setCategories(categoryData.data.items || []);
        }
      }

      // 加载商户列表
      await loadMerchants();
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMerchants = async (category?: string) => {
    try {
      const url = category && category !== '全部' 
        ? `/api/merchants?category=${encodeURIComponent(category)}`
        : '/api/merchants';
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setMerchants(data.data.items || []);
        }
      }
    } catch (error) {
      console.error('加载商户失败:', error);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    loadMerchants(category === '全部' ? undefined : category);
  };

  const allCategories = ['全部', ...categories.map(cat => cat.name)];

  const filteredMerchants = merchants;

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">附近的店铺</h1>
        <p className="text-gray-600">发现周边美食与便利</p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex space-x-2 pb-2">
          {allCategories.map(category => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : (
        /* 商户列表 */
        <div className="space-y-4">
          {filteredMerchants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无商户</div>
          ) : (
            filteredMerchants.map(merchant => (
              <div key={merchant.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex space-x-4">
                  {merchant.imageUrl && (
                    <div className="w-24 h-24 flex-shrink-0 relative">
                      <img
                        src={merchant.imageUrl}
                        alt={merchant.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          // 图片加载失败时隐藏
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{merchant.name}</h3>
                      {merchant.category && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                          {merchant.category}
                        </span>
                      )}
                    </div>
                    {merchant.description && (
                      <p className="text-sm text-gray-600 mb-2">{merchant.description}</p>
                    )}
                    {merchant.address && (
                      <div className="flex items-center text-gray-600 text-sm mb-1">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{merchant.address}</span>
                      </div>
                    )}
                    {merchant.phone && (
                      <div className="flex items-center text-gray-600 text-sm mb-1">
                        <Phone className="h-4 w-4 mr-1 flex-shrink-0" />
                        <a href={`tel:${merchant.phone}`} className="hover:text-blue-600">
                          {merchant.phone}
                        </a>
                      </div>
                    )}
                    {merchant.email && (
                      <div className="flex items-center text-gray-600 text-sm">
                        <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                        <a href={`mailto:${merchant.email}`} className="hover:text-blue-600">
                          {merchant.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NearbyPage;