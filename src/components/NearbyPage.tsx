import React, { useState } from 'react';
import Image from 'next/image';
import { Star, MapPin, Clock } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  type: string;
  distance: string;
  rating: number;
  address: string;
  openTime: string;
  imageUrl: string;
}

// 示例数据
const restaurantData: Restaurant[] = [
  {
    id: '1',
    name: '樱花日本料理',
    type: '日本料理',
    distance: '350m',
    rating: 4.5,
    address: '东京都新宿区西新宿1-2-3',
    openTime: '11:00-22:00',
    imageUrl: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=800&auto=format&fit=crop'
  },
  {
    id: '2',
    name: '北京烤鸭店',
    type: '中餐',
    distance: '500m',
    rating: 4.8,
    address: '东京都新宿区西新宿4-5-6',
    openTime: '11:30-21:30',
    imageUrl: 'https://images.unsplash.com/photo-1571167366136-b57e07761625?w=800&auto=format&fit=crop'
  },
  {
    id: '3',
    name: '7-Eleven',
    type: '便利店',
    distance: '150m',
    rating: 4.0,
    address: '东京都新宿区西新宿7-8-9',
    openTime: '24小时营业',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop'
  },
];

const categories = ['全部', '中餐', '日本料理', '便利店', '快餐', '咖啡厅'];

function NearbyPage() {
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const filteredRestaurants = restaurantData
    .filter(restaurant => selectedCategory === '全部' || restaurant.type === selectedCategory)
    .sort((a, b) => {
      if (sortBy === 'distance') {
        return parseInt(a.distance) - parseInt(b.distance);
      } else {
        return b.rating - a.rating;
      }
    });

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">附近的店铺</h1>
        <p className="text-gray-600">发现周边美食与便利</p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex space-x-2 pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* 排序选项 */}
      <div className="mb-6 flex space-x-4">
        <button
          onClick={() => setSortBy('distance')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${sortBy === 'distance' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
        >
          按距离
        </button>
        <button
          onClick={() => setSortBy('rating')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${sortBy === 'rating' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
        >
          按评分
        </button>
      </div>

      {/* 餐厅列表 */}
      <div className="space-y-4">
        {filteredRestaurants.map(restaurant => (
          <div key={restaurant.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex space-x-4">
              <div className="w-24 h-24 flex-shrink-0 relative">
                <Image
                  src={restaurant.imageUrl}
                  alt={restaurant.name}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-gray-900">{restaurant.name}</h3>
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="ml-1 text-sm">{restaurant.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{restaurant.type}</p>
                <div className="flex items-center text-gray-600 text-sm mb-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{restaurant.distance} · {restaurant.address}</span>
                </div>
                <div className="flex items-center text-gray-600 text-sm">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{restaurant.openTime}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NearbyPage;