'use client';

import { useState, useEffect } from 'react';

export default function HomepageChatItemMeta() {
  const [lastMessageTime, setLastMessageTime] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Derive unread badge from localStorage
    try {
      const raw = localStorage.getItem('messages_kruthika');
      if (raw) {
        const msgs = JSON.parse(raw);
        if (Array.isArray(msgs) && msgs.length > 0) {
          setUnreadCount(msgs[msgs.length - 1].sender === 'ai' ? 1 : 0);
        } else {
          setUnreadCount(1);
        }
      } else {
        setUnreadCount(1);
      }
    } catch {
      setUnreadCount(1);
    }

    // Derive timestamp from localStorage
    const updateTime = () => {
      try {
        const raw = localStorage.getItem('messages_kruthika');
        if (raw) {
          const msgs = JSON.parse(raw);
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.timestamp) {
            const date = new Date(lastMsg.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === today.toDateString()) {
              setLastMessageTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
            } else if (date.toDateString() === yesterday.toDateString()) {
              setLastMessageTime('Yesterday');
            } else {
              setLastMessageTime(date.toLocaleDateString([], { month: 'short', day: 'numeric' }));
            }
            return;
          }
        }
        setLastMessageTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      } catch {
        setLastMessageTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-end justify-between text-xs ml-2 shrink-0 min-w-[60px] h-full py-1">
      <span className="text-muted-foreground text-xs sm:text-sm">{lastMessageTime}</span>
      {unreadCount > 0 && (
        <div className="w-5 h-5 bg-[#25d366] rounded-full flex items-center justify-center mt-auto">
          <span className="text-xs font-bold text-white leading-none">{unreadCount}</span>
        </div>
      )}
    </div>
  );
}
