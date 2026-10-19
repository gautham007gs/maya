'use client';

import { useState, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export default function LiteChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'hey! 😊', sender: 'ai', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Mint a signed session before chat so quota is per-user, not shared NAT IP.
  useEffect(() => {
    fetch('/api/memory', { credentials: 'include' }).catch(() => {});
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          lite: true // Flag for lite mode processing
        })
      });

      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: 'ai',
        timestamp: Date.now()
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'sorry, network issue yaar 😅',
        sender: 'ai',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#fdf2f8'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#ec4899', 
        color: 'white',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>Kruthika 💕</h1>
      </div>

      {/* Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px'
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ 
            marginBottom: '12px',
            display: 'flex',
            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '70%',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: msg.sender === 'user' ? '#ec4899' : 'white',
              color: msg.sender === 'user' ? 'white' : '#1f2937'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#9ca3af', fontSize: '14px' }}>typing...</div>
        )}
      </div>

      {/* Input */}
      <div style={{ 
        padding: '12px', 
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Message..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            outline: 'none'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#ec4899',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
