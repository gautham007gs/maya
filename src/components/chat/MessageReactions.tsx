
"use client";

import { useState } from 'react';
import { Heart, Smile, ThumbsUp, Flame, Star } from 'lucide-react';

interface MessageReactionsProps {
  messageId: string;
  onReact: (emoji: string) => void;
  currentReaction?: string;
}

const reactions = [
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '😊', icon: Smile, label: 'Happy' },
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '🔥', icon: Flame, label: 'Fire' },
  { emoji: '⭐', icon: Star, label: 'Star' }
];

export function MessageReactions({ messageId: _messageId, onReact, currentReaction }: MessageReactionsProps) {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className="relative inline-block">
      {currentReaction ? (
        <button
          onClick={() => setShowReactions(!showReactions)}
          className="text-lg hover:scale-110 transition-transform"
        >
          {currentReaction}
        </button>
      ) : (
        <button
          onClick={() => setShowReactions(!showReactions)}
          className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-all"
        >
          React
        </button>
      )}
      
      {showReactions && (
        <div className="absolute bottom-full left-0 mb-2 bg-background border rounded-full shadow-lg p-2 flex gap-1 animate-in fade-in slide-in-from-bottom-2">
          {reactions.map(({ emoji, icon: _Icon, label }) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setShowReactions(false);
              }}
              className="hover:scale-125 transition-transform p-1"
              title={label}
            >
              <span className="text-lg">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
