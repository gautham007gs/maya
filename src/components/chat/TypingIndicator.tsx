// Server component — pure markup (avatar + CSS-animated dots), no state or
// effects. When imported from client chat components it still bundles fine.
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TypingIndicatorProps {
  avatarUrl: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ avatarUrl }) => {
  return (
    <div className="wa-typing-wrapper flex items-end space-x-2 mb-2">
      <Avatar className="h-8 w-8 mb-0.5 flex-shrink-0">
        <AvatarImage src={avatarUrl} alt="Avatar" />
        <AvatarFallback>K</AvatarFallback>
      </Avatar>
      <div className="wa-typing-bubble">
        <span className="wa-typing-dot" />
        <span className="wa-typing-dot" />
        <span className="wa-typing-dot" />
      </div>
    </div>
  );
};

export default TypingIndicator;
