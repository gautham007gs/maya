"use client";

import { usePathname } from 'next/navigation';
import { MessageSquareText, Users, EllipsisVertical, BookOpen, Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AppHeaderProps {
  title: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title }) => {
  const pathname = usePathname();
  const { t } = useLanguage();
  const localizedTitle = title === 'Privacy Policy'
    ? t.privacyPolicy
    : title === 'Terms of Service'
      ? t.termsOfService
      : title;

  const navItems = [
    { name: t.chats, href: '/', icon: <MessageSquareText size={20} /> },
    { name: t.status, href: '/status', icon: <Users size={20} /> },
  ];

  return (
    <header className="bg-[#25d366] text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-3xl">
        {/* Hard navigation home — full page reload (MPA) */}
        <a href="/" className="text-xl font-semibold hover:opacity-80 transition-opacity text-white no-underline">
           {localizedTitle}
        </a>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <EllipsisVertical size={24} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              {/* Hard navigation — MPA */}
              <a href="/blog" className="flex items-center gap-2 w-full cursor-pointer">
                <BookOpen size={16} />
                <span>{t.blog}</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.dispatchEvent(new Event('open-consent-settings'))}>
              <div className="flex items-center gap-2 w-full">
                <Shield size={16} />
                <span>{t.privacySettings}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/legal/privacy" className="flex items-center gap-2 w-full cursor-pointer">
                <Shield size={16} />
                <span>{t.privacyPolicy}</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/legal/terms" className="flex items-center gap-2 w-full cursor-pointer">
                <Info size={16} />
                <span>{t.termsOfService}</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Tab navigation — hard <a> links (MPA) */}
      <nav className="bg-[#25d366] border-t border-[#1faa55]" aria-label="Main navigation">
        <div className="container mx-auto flex justify-around items-center max-w-3xl">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 py-3 text-center text-sm font-medium flex flex-col items-center gap-1 transition-colors",
                pathname === item.href
                  ? 'text-white border-b-2 border-white/90'
                  : 'text-white/70 hover:text-white/90',
                "hover:bg-white/10"
              )}
            >
              {item.icon}
              <span>{item.name}</span>
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
};

export default AppHeader;
