
'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh() {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0 || window.scrollY > 0) return;
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;
      
      if (distance > 0 && distance < 150) {
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 80) {
        setIsRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.reload();
      }
      setStartY(0);
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDistance]);

  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#25d366] to-transparent"
      style={{ 
        height: `${pullDistance}px`,
        opacity: pullDistance / 100,
        transition: isRefreshing ? 'none' : 'opacity 0.2s'
      }}
    >
      <RefreshCw 
        className={`text-white ${isRefreshing ? 'animate-spin' : ''}`}
        size={24}
        style={{ transform: `rotate(${pullDistance * 2}deg)` }}
      />
    </div>
  );
}
