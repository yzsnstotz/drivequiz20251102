import React, { useState } from 'react';
import Image from 'next/image';
import { Star, MapPin, Clock, Car } from 'lucide-react';

interface CarItem {
  id: string;
  name: string;
  type: string;
  distance: string;
  rating: number;
  address: string;
  openTime: string;
  imageUrl: string;
  price: string;
}

// 示例数据
const carData: CarItem[] = [
  {
    id: '1',
    name: '丰田卡罗拉',
    type: '驾校用车',
    distance: '350m',
    rating: 4.5,
    address: '东京都新宿区西新宿1-2-3',
    openTime: '08:00-20:00',
    imageUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&auto=format&fit=crop',
    price: '¥3000/天'
  },
  {
    id: '2',
    name: '本田飞度',
    type: '租车',
    distance: '500m',
    rating: 4.8,
    address: '东京都新宿区西新宿4-5-6',
    openTime: '09:00-21:00',
    imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&auto=format&fit=crop',
    price: '¥2500/天'
  },
  {
    id: '3',
    name: '日产轩逸',
    type: '驾校用车',
    distance: '150m',
    rating: 4.0,
    address: '东京都新宿区西新宿7-8-9',
    openTime: '08:30-19:30',
    imageUrl: 'https://images.unsplash.com/photo-1580274418792-f82bd6415fc8?w=800&auto=format&fit=crop',
    price: '¥2800/天'
  },
];

const categories = ['全部', '驾校用车', '租车', '二手车', '汽车保养', '驾驶培训'];

function CarsPage() {
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const filteredCars = carData
    .filter(car => selectedCategory === '全部' || car.type === selectedCategory)
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
        <h1 className="text-2xl font-bold text-gray-900">汽车服务</h1>
        <p className="text-gray-600">驾校用车、租车等服务</p>
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

      {/* 汽车列表 */}
      <div className="space-y-4">
        {filteredCars.map(car => (
          <div key={car.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex space-x-4">
              <div className="w-24 h-24 flex-shrink-0 relative">
                <Image
                  src={car.imageUrl}
                  alt={car.name}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-gray-900">{car.name}</h3>
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="ml-1 text-sm">{car.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{car.type}</p>
                <div className="flex items-center text-gray-600 text-sm mb-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{car.distance} · {car.address}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600 text-sm">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{car.openTime}</span>
                  </div>
                  <span className="text-blue-600 font-medium">{car.price}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CarsPage;