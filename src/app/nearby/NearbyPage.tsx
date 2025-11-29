"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { getMultilangContent } from '@/lib/multilangUtils';

type Merchant = {
  id: number;
  name: string | { zh?: string; en?: string; ja?: string; default?: string };
  description: string | { zh?: string; en?: string; ja?: string; default?: string } | null;
  address: string | { zh?: string; en?: string; ja?: string; default?: string } | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  category: string | null;
};

type MerchantCategory = {
  id: number;
  name: string | { zh?: string; en?: string; ja?: string; default?: string };
  displayOrder: number;
};

// 缓存和请求去重机制（组件外部定义，避免每次渲染重新创建）
const categoryCache = {
  data: null as MerchantCategory[] | null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 分钟
};

const merchantCache = new Map<string, { data: Merchant[]; timestamp: number }>();
const MERCHANT_CACHE_TTL = 60 * 1000; // 1 分钟

const pendingRequests = new Map<string, Promise<any>>();

// 请求去重函数
const fetchWithDedup = async (url: string) => {
  // 如果已有相同请求在进行，等待它完成
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }
  
  const promise = fetch(url)
    .then(res => res.json())
    .finally(() => {
      pendingRequests.delete(url);
    });
  
  pendingRequests.set(url, promise);
  return promise;
};

function NearbyPage() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<MerchantCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 检查分类缓存
      const now = Date.now();
      let loadedCategories: MerchantCategory[] = [];
      
      if (categoryCache.data && (now - categoryCache.timestamp < categoryCache.ttl)) {
        // 使用缓存
        loadedCategories = categoryCache.data;
        setCategories(loadedCategories);
      } else {
        // 缓存失效，请求 API
        const categoryData = await fetchWithDedup('/api/merchant-categories');
        if (categoryData && categoryData.ok) {
          loadedCategories = categoryData.data.items || [];
          setCategories(loadedCategories);
          // 更新缓存
          categoryCache.data = loadedCategories;
          categoryCache.timestamp = now;
        }
      }

      // 加载商户列表
      // 如果有分类，默认选择第一个并加载该分类的商户
      if (loadedCategories.length > 0) {
        const firstCategoryId = loadedCategories[0].id;
        setSelectedCategoryId(firstCategoryId);
        // 使用已加载的分类数据来获取分类名称（使用中文名称，因为数据库中存储的是中文名称）
        const firstCategory = loadedCategories[0];
        const categoryName = typeof firstCategory.name === 'string' 
          ? firstCategory.name 
          : getMultilangContent(firstCategory.name, 'zh', '');
        if (categoryName) {
          await loadMerchantsByCategoryName(categoryName);
        } else {
          await loadMerchants(null);
        }
      } else {
        // 如果没有分类，加载所有商户
        await loadMerchants(null);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMerchantsByCategoryName = async (categoryName: string) => {
    try {
      const url = `/api/merchants?category=${encodeURIComponent(categoryName)}`;
      const cacheKey = `category:${categoryName}`;
      const now = Date.now();
      
      // 检查商户缓存
      const cached = merchantCache.get(cacheKey);
      if (cached && (now - cached.timestamp < MERCHANT_CACHE_TTL)) {
        // 使用缓存
        setMerchants(cached.data);
        return;
      }
      
      // 缓存失效，请求 API（使用请求去重）
      const data = await fetchWithDedup(url);
      if (data && data.ok) {
        const items = data.data.items || [];
        setMerchants(items);
        // 更新缓存
        merchantCache.set(cacheKey, { data: items, timestamp: now });
      }
    } catch (error) {
      console.error('加载商户失败:', error);
    }
  };

  // 根据分类的中文名称找到对应的分类对象
  const findCategoryByName = (categoryName: string): MerchantCategory | null => {
    if (!categoryName) return null;
    return categories.find(cat => {
      if (typeof cat.name === 'string') {
        return cat.name === categoryName;
      }
      // 如果是多语言对象，比较中文名称
      const zhName = getMultilangContent(cat.name, 'zh', '');
      return zhName === categoryName;
    }) || null;
  };

  const loadMerchants = async (categoryId?: number | null) => {
    try {
      if (categoryId !== null && categoryId !== undefined) {
        // 根据分类 ID 获取分类名称
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
          // 使用中文名称查询（因为数据库中商户的 category 字段存储的是中文名称）
          const categoryName = typeof category.name === 'string' 
            ? category.name 
            : getMultilangContent(category.name, 'zh', '');
          if (categoryName) {
            await loadMerchantsByCategoryName(categoryName);
            return;
          }
        }
      }
      // 如果没有指定分类或找不到分类，加载所有商户
      const url = '/api/merchants';
      const cacheKey = 'all';
      const now = Date.now();
      
      // 检查商户缓存
      const cached = merchantCache.get(cacheKey);
      if (cached && (now - cached.timestamp < MERCHANT_CACHE_TTL)) {
        // 使用缓存
        setMerchants(cached.data);
        return;
      }
      
      // 缓存失效，请求 API（使用请求去重）
      const data = await fetchWithDedup(url);
      if (data && data.ok) {
        const items = data.data.items || [];
        setMerchants(items);
        // 更新缓存
        merchantCache.set(cacheKey, { data: items, timestamp: now });
      }
    } catch (error) {
      console.error('加载商户失败:', error);
    }
  };

  const handleCategoryChange = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    loadMerchants(categoryId);
  };

  const filteredMerchants = merchants;

  return (
    <div className="container mx-auto px-4 py-6 pb-20">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('nearby.title')}</h1>
        <p className="text-gray-600">{t('nearby.subtitle')}</p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex space-x-2 pb-2">
          {categories.map(category => {
            const categoryName = typeof category.name === 'string' 
              ? category.name 
              : getMultilangContent(category.name, language, '');
            const isSelected = selectedCategoryId === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {categoryName}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('nearby.loading')}</div>
      ) : (
        /* 商户列表 */
        <div className="space-y-4">
          {filteredMerchants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('nearby.noMerchants')}</div>
          ) : (
            filteredMerchants.map(merchant => (
              <div key={merchant.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex space-x-4">
                  {merchant.imageUrl && (
                    <div className="w-24 h-24 flex-shrink-0 relative">
                      <img
                        src={merchant.imageUrl}
                        alt={getMultilangContent(merchant.name, language, '商户')}
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
                      <h3 className="text-lg font-bold text-gray-900">
                        {getMultilangContent(merchant.name, language, '商户')}
                      </h3>
                      {merchant.category && (() => {
                        const categoryObj = findCategoryByName(merchant.category);
                        const categoryDisplayName = categoryObj
                          ? getMultilangContent(categoryObj.name, language, merchant.category)
                          : merchant.category;
                        return (
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                            {categoryDisplayName}
                          </span>
                        );
                      })()}
                    </div>
                    {merchant.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {getMultilangContent(merchant.description, language, '')}
                      </p>
                    )}
                    {merchant.address && (
                      <div className="flex items-center text-gray-600 text-sm mb-1">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{getMultilangContent(merchant.address, language, '')}</span>
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