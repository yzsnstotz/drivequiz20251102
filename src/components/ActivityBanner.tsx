import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface BannerItem {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
}

const bannerData: BannerItem[] = [
  {
    id: 1,
    title: '“大乱斗”挑战赛火热开启中',
    description: '',
    imageUrl: 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/royalbattlecompetition.webp',
    link: 'https://zalem-app.gitbook.io/info/event/royalbattle'
  },
  {
    id: 2,
    title: '新！志愿者招募计划开启！',
    description: '',
    imageUrl: 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/volunteerreruitmentevent.webp',
    link: 'https://zalem-app.gitbook.io/info/event/volunteer-recruit'
  },
  {
    id: 3,
    title: '新！商家入驻计划开启！',
    description: '',
    imageUrl: 'https://raw.githubusercontent.com/yzsnstotz/drivequiz-experiment/refs/heads/main/image/banner/merchantrecruitevent.webp',
    link: 'https://zalem-app.gitbook.io/info/event/merchant-recruit'
  }
];

function ActivityBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    let interval = null;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        setCurrentIndex((prevIndex) =>
          prevIndex === bannerData.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAutoPlaying]);

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? bannerData.length - 1 : prevIndex - 1
    );
    setIsAutoPlaying(false);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === bannerData.length - 1 ? 0 : prevIndex + 1
    );
    setIsAutoPlaying(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > 75) {
      if (distance > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleBannerClick = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm">
      <div
        className="relative w-full h-48 md:h-64"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {bannerData.map((item, index) => (
          <div
            key={item.id}
            className={`absolute w-full h-full transition-transform duration-500 cursor-pointer ${index === currentIndex ? 'translate-x-0' : index < currentIndex ? '-translate-x-full' : 'translate-x-full'}`}
            onClick={() => handleBannerClick(item.link)}
          >
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
              <h3 className="text-lg font-bold mb-1">{item.title}</h3>
              <p className="text-sm">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={handlePrevious}
        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2 backdrop-blur-sm transition-colors"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {bannerData.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsAutoPlaying(false);
            }}
            className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-white' : 'bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default ActivityBanner;