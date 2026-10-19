
import { NextRequest, NextResponse } from 'next/server';
import SecurityValidator from './security-utils';
import crypto from 'crypto';
import { getClientIp } from './session-identity';

export class APISecurityManager {
  private static sessions = new Map<string, { userId: string; expires: number; csrfToken: string }>();
  
  // Secure session management
  static createSession(userId: string): { sessionId: string; csrfToken: string } {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const csrfToken = SecurityValidator.generateCSRFToken();
    
    this.sessions.set(sessionId, {
      userId,
      expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      csrfToken
    });
    
    return { sessionId, csrfToken };
  }
  
  // Validate session
  static validateSession(sessionId: string): { isValid: boolean; userId?: string; csrfToken?: string } {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.expires < Date.now()) {
      if (session) this.sessions.delete(sessionId);
      return { isValid: false };
    }
    
    return { isValid: true, userId: session.userId, csrfToken: session.csrfToken };
  }
  
  // API security middleware
  static async secureAPIRoute(
    request: NextRequest,
    options: {
      requireAuth?: boolean;
      requireCSRF?: boolean;
      allowedMethods?: string[];
      rateLimit?: { requests: number; window: number };
    } = {}
  ): Promise<NextResponse | null> {
    const clientIP = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Method validation
    if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }
    
    // Bot detection
    if (this.detectBot(userAgent)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Rate limiting
    if (options.rateLimit && !this.checkAPIRateLimit(clientIP, options.rateLimit)) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded',
        retryAfter: options.rateLimit.window 
      }, { status: 429 });
    }
    
    // Authentication check
    if (options.requireAuth) {
      const authHeader = request.headers.get('authorization');
      const sessionId = request.headers.get('x-session-id');
      
      if (!authHeader && !sessionId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      
      if (sessionId) {
        const session = this.validateSession(sessionId);
        if (!session.isValid) {
          return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }
      }
    }
    
    // CSRF protection
    if (options.requireCSRF && request.method === 'POST') {
      const csrfToken = request.headers.get('x-csrf-token');
      const sessionId = request.headers.get('x-session-id');
      
      if (!csrfToken || !sessionId) {
        return NextResponse.json({ error: 'CSRF token required' }, { status: 403 });
      }
      
      const session = this.validateSession(sessionId);
      if (!session.isValid || !SecurityValidator.validateCSRFToken(csrfToken, session.csrfToken!)) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }
    }
    
    return null; // Continue processing
  }
  
  // Bot detection
  private static detectBot(userAgent: string): boolean {
    const botPatterns = [
      /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit/i,
      /crawl|spider|scraper|bot/i,
      /curl|wget|python-requests|php|java|go-http|postman/i
    ];
    
    return botPatterns.some(pattern => pattern.test(userAgent));
  }
  
  // API rate limiting
  private static apiRateLimits = new Map<string, number[]>();
  
  private static checkAPIRateLimit(clientIP: string, limit: { requests: number; window: number }): boolean {
    const now = Date.now();
    const requests = this.apiRateLimits.get(clientIP) || [];
    
    const recentRequests = requests.filter(timestamp => now - timestamp < limit.window);
    
    if (recentRequests.length >= limit.requests) {
      return false;
    }
    
    recentRequests.push(now);
    this.apiRateLimits.set(clientIP, recentRequests);
    return true;
  }
  
  // Input validation for API requests
  static validateAPIInput(data: any, schema: any): { isValid: boolean; errors?: string[]; sanitized?: any } {
    const errors: string[] = [];
    const sanitized: any = {};
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      const ruleSet = rules as any;
      
      // Required check
      if (ruleSet.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }
      
      if (value === undefined || value === null) continue;
      
      // Type validation
      if (ruleSet.type && typeof value !== ruleSet.type) {
        errors.push(`${key} must be of type ${ruleSet.type}`);
        continue;
      }
      
      // String validation
      if (typeof value === 'string') {
        if (ruleSet.minLength && value.length < ruleSet.minLength) {
          errors.push(`${key} must be at least ${ruleSet.minLength} characters`);
          continue;
        }
        
        if (ruleSet.maxLength && value.length > ruleSet.maxLength) {
          errors.push(`${key} must be no more than ${ruleSet.maxLength} characters`);
          continue;
        }
        
        if (ruleSet.pattern && !ruleSet.pattern.test(value)) {
          errors.push(`${key} format is invalid`);
          continue;
        }
        
        // Sanitize string
        sanitized[key] = SecurityValidator.validateMessageInput(value).sanitized || value;
      } else {
        sanitized[key] = value;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      sanitized
    };
  }
  
  // Cleanup expired sessions and rate limits
  static cleanup(): void {
    const now = Date.now();
    
    // Clean expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expires < now) {
        this.sessions.delete(sessionId);
      }
    }
    
    // Clean API rate limits
    for (const [ip, requests] of this.apiRateLimits.entries()) {
      const recent = requests.filter(timestamp => now - timestamp < 300000); // 5 min
      if (recent.length === 0) {
        this.apiRateLimits.delete(ip);
      } else {
        this.apiRateLimits.set(ip, recent);
      }
    }
  }
}

export default APISecurityManager;
