
'use client';

import { useEffect, useRef } from 'react';
import { analyticsTracker } from '@/lib/analytics-tracker';

// Hook to integrate analytics into chat components
export const useAnalyticsTracking = () => {
  const sessionStartTime = useRef<number>(Date.now());
  const lastActivityTime = useRef<number>(Date.now());

  useEffect(() => {
    // Track page view
    analyticsTracker.trackPageView('maya-chat');

    // Update session duration tracking
    const updateSessionDuration = () => {
      if (typeof window !== 'undefined') {
        const duration = (Date.now() - sessionStartTime.current) / 1000 / 60; // minutes
        localStorage.setItem('current_session_duration', duration.toFixed(1));
        localStorage.setItem('session_start_time', sessionStartTime.current.toString());
      }
    };

    // Update session duration every 30 seconds
    const sessionInterval = setInterval(updateSessionDuration, 30000);

    // Track user activity
    const trackActivity = () => {
      lastActivityTime.current = Date.now();
      analyticsTracker.trackUserAction('chat_interaction', {
        type: 'activity_ping',
        sessionDuration: (Date.now() - sessionStartTime.current) / 1000 / 60
      });
    };

    // Set up activity tracking
    const activityEvents = ['click', 'keypress', 'scroll', 'mousemove'];
    const throttledTrackActivity = throttle(trackActivity, 60000); // Once per minute

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledTrackActivity);
    });

    // Set up message tracking observer with better detection
    const messageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const element = node as HTMLElement;
              
              // More robust message detection
              const isMessage = element.classList.contains('message') || 
                               element.querySelector('.message') || 
                               element.getAttribute('data-message-id') ||
                               (element.textContent && element.textContent.length > 10);

              if (isMessage) {
                const messageElement = element.classList.contains('message') ? 
                                     element : 
                                     element.querySelector('.message') as HTMLElement;
                
                if (messageElement) {
                  const isUserMessage = messageElement.classList.contains('user-message') ||
                                       messageElement.querySelector('.user-message') ||
                                       messageElement.getAttribute('data-sender') === 'user';
                  
                  const hasImage = messageElement.querySelector('img') !== null;
                  const messageId = messageElement.getAttribute('data-message-id') || 
                                   `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  const content = messageElement.textContent || '';

                  // Track the message
                  analyticsTracker.trackMessage(
                    messageId,
                    isUserMessage ? 'user' : 'ai',
                    content,
                    hasImage
                  );

                  // Track image sharing separately
                  if (hasImage) {
                    const img = messageElement.querySelector('img');
                    if (img && img.src) {
                      analyticsTracker.trackImageShare(img.src);
                    }
                  }

                  console.log('📊 Analytics: Tracked message', {
                    id: messageId,
                    type: isUserMessage ? 'user' : 'ai',
                    hasImage,
                    length: content.length
                  });
                }
              }
            }
          });
        }
      });
    });

    // Observe multiple possible chat containers
    const possibleSelectors = [
      '.chat-container',
      '[data-chat-container]',
      '.messages-container',
      '.chat-messages',
      '#chat-container',
      '.message-list'
    ];

    let observedContainer = null;
    for (const selector of possibleSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        messageObserver.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-message-id', 'class']
        });
        observedContainer = container;
        console.log('📊 Analytics: Observing chat container:', selector);
        break;
      }
    }

    // Fallback: observe document body if no specific container found
    if (!observedContainer) {
      messageObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      console.log('📊 Analytics: Observing document body as fallback');
    }

    // Simple ad presence tracking (no optimization)
    const setupAdTracking = () => {
      const adElements = document.querySelectorAll('[data-ad-type]');
      
      adElements.forEach(adElement => {
        const adType = adElement.getAttribute('data-ad-type') || 'banner';
        
        // Simple click tracking only
        adElement.addEventListener('click', () => {
          console.log('Ad clicked:', adType);
        });
      });
    };

    // Simple one-time setup
    setTimeout(setupAdTracking, 2000);

    // Cleanup function
    return () => {
      messageObserver.disconnect();
      clearInterval(sessionInterval);
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledTrackActivity);
      });

      // Final session duration update
      updateSessionDuration();
    };
  }, []);

  return {
    trackMessage: analyticsTracker.trackMessage.bind(analyticsTracker),
    trackImageShare: analyticsTracker.trackImageShare.bind(analyticsTracker),
    trackAdInteraction: analyticsTracker.trackAdInteractionPublic.bind(analyticsTracker),
    trackUserAction: analyticsTracker.trackUserAction.bind(analyticsTracker)
  };
};

// Utility function for throttling
function throttle(func: Function, limit: number) {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Component to add analytics to existing chat
export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAnalyticsTracking();
  
  useEffect(() => {
    // Initialize real-time metrics tracking
    const startRealTimeTracking = () => {
      // Track performance metrics
      if (typeof window !== 'undefined' && 'performance' in window) {
        const paintMetrics = performance.getEntriesByType('paint');
        paintMetrics.forEach(metric => {
          analyticsTracker.trackUserAction('performance_metric', {
            name: metric.name,
            startTime: metric.startTime,
            duration: metric.duration
          });
        });

        // Track resource loading times
        const resourceMetrics = performance.getEntriesByType('resource');
        const slowResources = resourceMetrics.filter(resource => resource.duration > 1000);
        if (slowResources.length > 0) {
          analyticsTracker.trackUserAction('slow_resources', {
            count: slowResources.length,
            slowestResource: slowResources[0].name,
            duration: slowResources[0].duration
          });
        }
      }
    };

    startRealTimeTracking();
  }, []);

  return <>{children}</>;
};

// Export for direct usage
export { analyticsTracker };
