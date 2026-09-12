'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { trackChatMessage } from '@/lib/user-tagging';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatInputProps {
  onSendMessage: (text: string, imageUri?: string) => void;
  isAiTyping: boolean;
  onBeforeSend?: () => void;
  /** Pass false when the device has no network — messages will be queued instead */
  isOnline?: boolean;
  /** Called instead of onSendMessage when offline */
  onQueueMessage?: (text: string, imageUri?: string) => void;
}

const LAST_MESSAGE_TIME_KEY = 'kruthika_last_message_time';
const MESSAGE_COOLDOWN_MS = 2000;
const SHORT_MESSAGE_SPAM_THRESHOLD = 3;
const SHORT_MESSAGE_SPAM_WINDOW_MS = 10000;
const SHORT_MESSAGE_SPAM_KEY = 'kruthika_short_message_spam_count';
const SHORT_MESSAGE_SPAM_TIME_KEY = 'kruthika_short_message_spam_time';

// Min height of the textarea (matches min-h-[2rem] = 32px)
const TEXTAREA_MIN_HEIGHT = 32;

const isMessageMeaningless = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length > 2) return false;
  const emojiRegex = /^[\p{Emoji}\p{Emoji_Component}]+$/u;
  const punctuationRegex = /^[.,!?;:'"()\-_+={}[\]|\\/<>@#$%^&*~`]+$/;
  const singleCharRegex = /^[a-zA-Z0-9]$/;
  return emojiRegex.test(trimmed) || punctuationRegex.test(trimmed) || singleCharRegex.test(trimmed);
};

const checkSpamRate = (): { isSpam: boolean; message?: string } => {
  if (typeof window === 'undefined') return { isSpam: false };
  const lastMessageTime = localStorage.getItem(LAST_MESSAGE_TIME_KEY);
  const now = Date.now();
  if (lastMessageTime) {
    const timeSinceLastMessage = now - parseInt(lastMessageTime);
    if (timeSinceLastMessage < MESSAGE_COOLDOWN_MS) {
      return {
        isSpam: true,
        message: `Please wait ${Math.ceil((MESSAGE_COOLDOWN_MS - timeSinceLastMessage) / 1000)} seconds before sending another message`,
      };
    }
  }
  return { isSpam: false };
};

const checkShortMessageSpam = (text: string): { isSpam: boolean; message?: string } => {
  if (typeof window === 'undefined') return { isSpam: false };
  if (!isMessageMeaningless(text)) return { isSpam: false };
  const now = Date.now();
  const spamCount = parseInt(localStorage.getItem(SHORT_MESSAGE_SPAM_KEY) || '0');
  const spamTime = parseInt(localStorage.getItem(SHORT_MESSAGE_SPAM_TIME_KEY) || '0');
  if (now - spamTime > SHORT_MESSAGE_SPAM_WINDOW_MS) {
    localStorage.setItem(SHORT_MESSAGE_SPAM_KEY, '1');
    localStorage.setItem(SHORT_MESSAGE_SPAM_TIME_KEY, now.toString());
    return { isSpam: false };
  }
  const newCount = spamCount + 1;
  localStorage.setItem(SHORT_MESSAGE_SPAM_KEY, newCount.toString());
  if (newCount >= SHORT_MESSAGE_SPAM_THRESHOLD) {
    return {
      isSpam: true,
      message: 'Please send a proper message instead of single characters or emojis.',
    };
  }
  return { isSpam: false };
};

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isAiTyping: _isAiTyping,
  onBeforeSend,
  isOnline = true,
  onQueueMessage,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Resize textarea to fit content, clamped to max 96px
  const resizeTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = `${TEXTAREA_MIN_HEIGHT}px`; // reset first
    const scrollH = el.scrollHeight;
    el.style.height = `${Math.min(scrollH, 96)}px`;
  }, []);

  // Collapse textarea back to min height smoothly
  const collapseTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Image Too Large", description: "Max image size is 2MB.", variant: "destructive", duration: 5000 });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        toast({ title: "Invalid File Type", description: "Please select a JPG, PNG, WEBP, or GIF image.", variant: "destructive", duration: 5000 });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        if (!inputValue.trim()) {
          onSendMessage('', reader.result as string);
          setSelectedImage(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = useCallback((e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const textToSend = inputValue.trim();
    const imageToSend = selectedImage;

    if (!textToSend && !imageToSend) return;

    // ── Offline handling ────────────────────────────────────────────────────
    // When the device has no network, save the message in localStorage so it
    // can be sent automatically the moment the user reconnects.
    if (!isOnline) {
      if (onQueueMessage) onQueueMessage(textToSend, imageToSend || undefined);
      setInputValue('');
      setSelectedImage(null);
      if (textareaRef.current) collapseTextarea(textareaRef.current);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast({
        title: "You're offline 📶",
        description: "Message saved — will send when you reconnect.",
        duration: 4000,
      });
      return;
    }

    // Notify parent to lock viewport height updates during send-flicker window
    onBeforeSend?.();

    const spamCheck = checkSpamRate();
    if (spamCheck.isSpam) {
      toast({ title: "Slow down! ⏱️", description: spamCheck.message, variant: "destructive", duration: 3000 });
      return;
    }

    const shortMessageCheck = checkShortMessageSpam(textToSend);
    if (shortMessageCheck.isSpam && !imageToSend) {
      toast({ title: "Message Blocked", description: shortMessageCheck.message, variant: "destructive", duration: 4000 });
      return;
    }

    localStorage.setItem(LAST_MESSAGE_TIME_KEY, Date.now().toString());

    setIsLoading(true);
    trackChatMessage();
    onSendMessage(textToSend, imageToSend || undefined);

    // Clear text and collapse textarea without losing keyboard focus
    setInputValue('');
    setSelectedImage(null);
    if (textareaRef.current) {
      collapseTextarea(textareaRef.current);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Re-focus after the next paint so the browser finishes the current layout
    // pass before deciding whether to dismiss the keyboard. Calling focus()
    // synchronously can trigger a second layout + viewport-resize event on
    // some Android versions, which is what causes the visible "jump".
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 120);
    });

    setIsLoading(false);
  }, [inputValue, selectedImage, onSendMessage, toast, collapseTextarea, isOnline, onQueueMessage, onBeforeSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    if (!isTyping) setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);

    if (textareaRef.current) {
      resizeTextarea(textareaRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end p-2 bg-[#F0F0F0] dark:bg-gray-900 gap-2"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="text-gray-600 hover:text-gray-700 self-end shrink-0 h-10 w-10 rounded-full"
          aria-label={showEmojiPicker ? t.closeEmojiPicker : t.openEmojiPicker}
      >
        <Smile className="h-6 w-6" />
      </Button>

      <div className="flex flex-1 items-center bg-white dark:bg-gray-800 rounded-[24px] px-3 py-1.5 gap-2">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t.messagePlaceholder}
          className="flex-1 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent custom-scrollbar py-2 text-[15px] leading-tight max-h-20 min-h-[2rem] placeholder:text-gray-500"
          style={{ transition: 'height 60ms ease', height: `${TEXTAREA_MIN_HEIGHT}px` }}
          rows={1}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageChange}
          id="file-upload-input"
          aria-label={t.uploadImage}
        />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="text-gray-600 hover:text-gray-700 self-end shrink-0 h-9 w-9 p-0"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t.uploadImage}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </div>

      {inputValue.trim() || selectedImage ? (
        <Button
          type="button"
          size="icon"
          className="bg-[#25d366] hover:bg-[#1faa55] self-end shrink-0 h-12 w-12 rounded-full"
          aria-label={isLoading ? t.sendingMessage : t.sendMessage}
          // type="button" + explicit onClick so that onBeforeSend (send-lock) is
          // always called on every browser, including Android where
          // preventDefault on pointerdown can suppress the form submit event.
          onClick={() => handleSubmit()}
          // Prevent focus from moving to the button — keeps the textarea focused
          // so the keyboard never dismisses on tap.
          onPointerDown={(e) => e.preventDefault()}
        >
          {isLoading
            ? <Loader2 className="h-5 w-5 animate-spin text-white" />
            : <Send className="h-5 w-5 text-white" />}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="bg-[#25d366] hover:bg-[#1faa55] text-white self-end shrink-0 h-12 w-12 rounded-full"
          aria-label={t.openMicrophone}
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}
    </form>
  );
};

export default ChatInput;
