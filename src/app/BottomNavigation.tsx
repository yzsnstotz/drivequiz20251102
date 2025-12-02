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
import { useLanguage } from '@/lib/i18n';

export default function BottomNavigation() {
  const pathname = usePathname();
  const { t } = useLanguage();
  
  // 在AI页面、admin路由、登录页面隐藏底部导航栏
  if (pathname === '/ai' || pathname.startsWith('/admin/') || pathname.startsWith('/login')) {
    return null;
  }
  
  const navItems = [
    { 
      href: '/', 
      icon: Home, 
      label: t('nav.home'),
      active: pathname === '/'
    },
    { 
      href: '/study', 
      icon: Book, 
      label: t('nav.study'),
      active: pathname === '/study'
    },
    { 
      href: '/nearby', 
      icon: UtensilsCrossed, 
      label: t('nav.services'),
      active: pathname === '/nearby'
    },
    { 
      href: '/profile', 
      icon: User, 
      label: t('nav.profile'),
      active: pathname === '/profile'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 ios-nav-blur dark:ios-nav-blur-dark border-t border-gray-200/50 dark:border-ios-dark-border z-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center space-y-1 px-4 py-2 ios-button transition-all duration-200 ${
                  item.active 
                    ? 'text-blue-600 dark:text-blue-500 scale-105' 
                    : 'text-gray-600 dark:text-ios-dark-text-secondary active:scale-95 active:opacity-70'
                }`}
              >
                <IconComponent className={`h-6 w-6 transition-transform duration-200 ${item.active ? 'scale-110' : ''}`} />
                <span className={`text-xs font-medium transition-all duration-200 ${item.active ? 'font-semibold' : ''}`} suppressHydrationWarning>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}