/**
 * Unified Performance Monitoring and Optimization System
 * Consolidates performance-diagnostics.ts, performance-optimization.ts, and memory-optimizer.ts
 * Optimized for production with minimal overhead
 */

/* PerformanceMetrics interface reserved for future use:
interface PerformanceMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
} */

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private observers: PerformanceObserver[] = [];
  private metrics: Map<string, number[]> = new Map();
  private cleanupTasks: (() => void)[] = [];
  private memoryCheckInterval?: NodeJS.Timeout;
  private readonly maxCacheSize = 50 * 1024 * 1024; // 50MB

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    // Only initialize Core Web Vitals in production for efficiency
    if (process.env.NODE_ENV === 'production') {
      this.initializeWebVitals();
    }

    // Memory monitoring (runs every 5 minutes, not every minute)
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 300000); // 5 minutes instead of 1

    // Cleanup on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performCleanup();
      }
    });

    // Cleanup before page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  // Core Web Vitals Monitoring (lightweight)
  initializeWebVitals() {
    if (typeof window === 'undefined') return;

    // LCP Observer
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        const lcp = lastEntry.renderTime || lastEntry.loadTime;
        this.recordMetric('LCP', lcp);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      // Observer not supported
    }

    // FID Observer
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          this.recordMetric('FID', fid);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      // Observer not supported
    }

    // CLS Observer
    let clsValue = 0;
    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.recordMetric('CLS', clsValue);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);
    } catch (e) {
      // Observer not supported
    }

    // TTFB
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.requestStart;
        this.recordMetric('TTFB', ttfb);
      }
    }, { once: true });
  }

  // Resource Analysis (for diagnostics page only)
  analyzeResourceLoading() {
    if (typeof window === 'undefined') return null;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const analysis = {
      scripts: [] as any[],
      styles: [] as any[],
      images: [] as any[],
      fonts: [] as any[],
      total: resources.length
    };

    resources.forEach((resource) => {
      const data = {
        name: resource.name.split('/').pop(),
        duration: resource.duration,
        size: (resource as any).transferSize || 0,
        cached: (resource as any).transferSize === 0
      };

      if (resource.name.includes('.js')) analysis.scripts.push(data);
      else if (resource.name.includes('.css')) analysis.styles.push(data);
      else if (resource.name.match(/\.(png|jpg|jpeg|gif|webp|svg)/)) analysis.images.push(data);
      else if (resource.name.match(/\.(woff|woff2|ttf)/)) analysis.fonts.push(data);
    });

    return analysis;
  }

  // Memory Monitoring
  monitorMemory() {
    if (typeof window === 'undefined' || !(performance as any).memory) return null;

    const memory = (performance as any).memory;
    const used = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const total = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const limit = (memory.jsHeapSizeLimit / 1048576).toFixed(2);

    return { used: parseFloat(used), total: parseFloat(total), limit: parseFloat(limit) };
  }

  // Network Quality Detection
  detectNetworkQuality() {
    if (typeof navigator === 'undefined' || !(navigator as any).connection) return null;

    const connection = (navigator as any).connection;
    return {
      type: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  // Generate Performance Report (for diagnostics)
  generateReport() {
    if (typeof console === 'undefined') return;

    console.log('\n🎯 PERFORMANCE REPORT');
    console.log('═'.repeat(50));
    
    const analysis = this.analyzeResourceLoading();
    const memory = this.monitorMemory();
    const network = this.detectNetworkQuality();
    
    if (analysis) {
      console.log('📦 Resources:', {
        total: analysis.total,
        scripts: analysis.scripts.length,
        styles: analysis.styles.length,
        images: analysis.images.length
      });
    }
    
    if (memory) {
      console.log(`🧠 Memory: ${memory.used}MB / ${memory.total}MB (Limit: ${memory.limit}MB)`);
    }
    
    if (network) {
      console.log('📡 Network:', network.type, `${network.downlink}Mbps`);
    }
    
    console.log('\n📊 Core Web Vitals:');
    ['LCP', 'FID', 'CLS', 'TTFB'].forEach(metric => {
      const values = this.metrics.get(metric);
      if (values && values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const emoji = this.getScoreEmoji(metric, avg);
        console.log(`${metric}: ${avg.toFixed(2)} ${emoji}`);
      }
    });
    
    console.log('═'.repeat(50));
  }

  // Memory Management
  private checkMemoryUsage() {
    if (typeof performance === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    const usedMemory = memory.usedJSHeapSize;
    const memoryLimit = memory.jsHeapSizeLimit;

    // If using > 80% of available memory, trigger cleanup
    if (usedMemory > memoryLimit * 0.8) {
      this.performCleanup();
      this.cleanupLocalStorage();
    }
  }

  private cleanupLocalStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      let totalSize = 0;
      const items: { key: string; size: number; timestamp?: number }[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const value = localStorage.getItem(key) || '';
        const size = new Blob([value]).size;
        totalSize += size;

        // Parse timestamp if available
        let timestamp;
        try {
          const parsed = JSON.parse(value);
          timestamp = parsed.timestamp || parsed.lastUpdated || 0;
        } catch {
          timestamp = 0;
        }

        items.push({ key, size, timestamp });
      }

      // If exceeding max size, remove oldest items
      if (totalSize > this.maxCacheSize) {
        items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        let removed = 0;
        for (const item of items) {
          if (totalSize - removed < this.maxCacheSize * 0.7) break;
          
          // Don't remove critical items
          if (!item.key.includes('user_pseudo_id') && 
              !item.key.includes('isAdminLoggedIn') &&
              !item.key.includes('cookie_consent')) {
            localStorage.removeItem(item.key);
            removed += item.size;
          }
        }
      }
    } catch (error) {
      console.error('[Performance] Error cleaning localStorage:', error);
    }
  }

  private performCleanup() {
    // Execute registered cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('[Performance] Cleanup task failed:', error);
      }
    });

    // Clear session storage except critical data
    if (typeof sessionStorage !== 'undefined') {
      try {
        const keysToKeep = ['user_session', 'admin_session', '__Host-admin_session'];
        const sessionData: Record<string, string> = {};

        keysToKeep.forEach(key => {
          const value = sessionStorage.getItem(key);
          if (value) sessionData[key] = value;
        });

        sessionStorage.clear();

        Object.entries(sessionData).forEach(([key, value]) => {
          sessionStorage.setItem(key, value);
        });
      } catch (error) {
        console.error('[Performance] Error cleaning sessionStorage:', error);
      }
    }
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    // Keep only last 10 values to prevent memory growth
    const values = this.metrics.get(name)!;
    values.push(value);
    if (values.length > 10) {
      values.shift();
    }
  }

  private getScoreEmoji(metric: string, value: number): string {
    const thresholds: Record<string, { good: number; poor: number }> = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric] || { good: 100, poor: 300 };
    if (value <= threshold.good) return '🟢';
    if (value <= threshold.poor) return '🟡';
    return '🔴';
  }

  public registerCleanupTask(task: () => void) {
    this.cleanupTasks.push(task);
  }

  public forceCleanup() {
    this.performCleanup();
    this.cleanupLocalStorage();
  }

  public cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
  }
}

// Utility Functions (previously from performance-optimization.ts)

export const scheduleTask = (
  task: () => void, 
  priority: 'user-blocking' | 'user-visible' | 'background' = 'background'
) => {
  if (typeof window !== 'undefined' && 'scheduler' in window && (window as any).scheduler?.postTask) {
    return (window as any).scheduler.postTask(task, { priority });
  }

  const delay = priority === 'user-blocking' ? 0 : priority === 'user-visible' ? 5 : 50;
  return new Promise(resolve => setTimeout(() => resolve(task()), delay));
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const lazyLoadImages = () => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  }, { rootMargin: '50px' }); // Pre-load images 50px before they appear

  document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
  });
};

export const prefetchResource = (
  url: string, 
  as: 'script' | 'style' | 'image' | 'fetch' = 'fetch'
) => {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = as;
  link.setAttribute('crossorigin', 'anonymous');
  document.head.appendChild(link);
};

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Legacy exports for backward compatibility
export const PerformanceDiagnostics = PerformanceMonitor;
export const PerformanceOptimizer = PerformanceMonitor;
export const memoryOptimizer = performanceMonitor;
