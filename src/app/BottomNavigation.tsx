'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Book, 
  UtensilsCrossed, 
  Truck, 
  User 
} from 'lucide-react';

export default function BottomNavigation() {
  const pathname = usePathname();
  
  const navItems = [
    { 
      href: '/', 
      icon: Home, 
      label: '首页',
      active: pathname === '/'
    },
    { 
      href: '/study', 
      icon: Book, 
      label: '学习',
      active: pathname === '/study'
    },
    { 
      href: '/nearby', 
      icon: UtensilsCrossed, 
      label: '食宿',
      active: pathname === '/nearby'
    },
    { 
      href: '/cars', 
      icon: Truck, 
      label: '汽车',
      active: pathname === '/cars'
    },
    { 
      href: '/profile', 
      icon: User, 
      label: '我的',
      active: pathname === '/profile'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center space-y-1 px-4 py-2 ${
                  item.active ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <IconComponent className="h-6 w-6" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}