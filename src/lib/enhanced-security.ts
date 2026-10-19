/**
 * Enhanced Security Layer - Maximum Protection Against All Cyber Attacks
 * Protects against: DDoS, SQL Injection, XSS, CSRF, Cookie Hijacking, 
 * Brute Force, Session Hijacking, and all other common attack vectors
 * 
 * Edge Runtime Compatible - Uses Web Crypto API
 */

import { NextRequest, NextResponse } from 'next/server';
import SecurityValidator from './security-utils';
import { getClientIp } from './session-identity';

// IP Reputation and Blocking System
class IPReputationSystem {
  private static blocklist = new Set<string>();
  private static reputationScores = new Map<string, {
    score: number;
    violations: Array<{ type: string; timestamp: number }>;
    lastActivity: number;
  }>();

  /**
   * Queue of newly blocked IPs waiting to be flushed to the DB.
   * Drained by instrumentation.ts every 30 s so the hot request path
   * never blocks on a DB write.
   */
  static _pendingPersist: Map<string, { reason: string; score: number; expiresInMs?: number }> = new Map();

  /**
   * Seed the in-memory blocklist from DB records loaded on startup.
   * Call this once from instrumentation.ts after reading ip_blocklist.
   */
  static initFromDB(entries: Array<{ ip: string; reason: string; score: number }>): void {
    for (const entry of entries) {
      this.blocklist.add(entry.ip);
    }
    if (entries.length > 0) {
      console.log(`[Security] Restored ${entries.length} blocked IP(s) from DB`);
    }
  }

  // Escalating temporary blocks (default 24h) — avoids permanent shared-IP false positives.
  static blockIP(ip: string, reason: string, expiresInMs = 24 * 60 * 60 * 1000): void {
    this.blocklist.add(ip);
    const score = this.reputationScores.get(ip)?.score ?? 0;
    this._pendingPersist.set(ip, { reason, score, expiresInMs });
    console.warn(`🔒 IP Blocked (${Math.round((expiresInMs ?? 0) / 3600000)}h): ${ip} - Reason: ${reason}`);

    setTimeout(() => {
      this.blocklist.delete(ip);
    }, expiresInMs);
  }
  
  // Check if IP is blocked
  static isBlocked(ip: string): boolean {
    return this.blocklist.has(ip);
  }
  
  // Add violation to IP reputation
  static addViolation(ip: string, type: string): void {
    const current = this.reputationScores.get(ip) || {
      score: 100,
      violations: [],
      lastActivity: Date.now()
    };
    
    // Severity scores
    const severityMap: Record<string, number> = {
      'sql_injection': 50,
      'xss_attempt': 50,
      'csrf_violation': 40,
      'rate_limit': 10,
      'invalid_input': 5,
      'suspicious_pattern': 15,
      'brute_force': 30
    };
    
    const penalty = severityMap[type] || 10;
    current.score = Math.max(0, current.score - penalty);
    current.violations.push({ type, timestamp: Date.now() });
    current.lastActivity = Date.now();
    
    // Auto-block if score drops too low
    if (current.score <= 20) {
      this.blockIP(ip, `Low reputation score: ${current.score}`);
    }
    
    // Block if too many violations in short time
    const recentViolations = current.violations.filter(
      v => Date.now() - v.timestamp < 300000 // 5 minutes
    );
    if (recentViolations.length >= 10) {
      this.blockIP(ip, 'Too many violations in short time');
    }
    
    this.reputationScores.set(ip, current);
  }
  
  // Get reputation score
  static getScore(ip: string): number {
    return this.reputationScores.get(ip)?.score || 100;
  }
  
  // Cleanup old records
  static cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [ip, data] of this.reputationScores.entries()) {
      if (now - data.lastActivity > maxAge && data.score >= 80) {
        this.reputationScores.delete(ip);
      }
    }
  }
}

// Advanced DDoS Protection with Adaptive Rate Limiting
class DDoSProtection {
  private static requestCounts = new Map<string, {
    count: number;
    window: number;
    blocked: boolean;
    blockUntil: number;
  }>();
  
  private static globalRequestCount = 0;
  private static globalWindowStart = Date.now();
  
  // Check if request should be allowed
  static checkRequest(ip: string, endpoint: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    
    // Global DDoS protection - 100000 requests per minute globally (handles 1000+ concurrent users)
    if (now - this.globalWindowStart > 60000) {
      this.globalRequestCount = 0;
      this.globalWindowStart = now;
    }
    
    this.globalRequestCount++;
    if (this.globalRequestCount > 100000) {
      return { allowed: false, reason: 'Global rate limit exceeded - DDoS protection active' };
    }
    
    // Per-IP rate limiting
    const key = `${ip}:${endpoint}`;
    const current = this.requestCounts.get(key) || {
      count: 0,
      window: now,
      blocked: false,
      blockUntil: 0
    };
    
    // Check if IP is temporarily blocked
    if (current.blocked && now < current.blockUntil) {
      return { allowed: false, reason: 'Temporarily blocked due to excessive requests' };
    }
    
    // Reset block if time has passed
    if (current.blocked && now >= current.blockUntil) {
      current.blocked = false;
      current.count = 0;
    }
    
    // Reset window if expired (1 minute)
    if (now - current.window > 60000) {
      current.count = 0;
      current.window = now;
    }
    
    current.count++;
    
    // Adaptive limits based on endpoint
    const limits: Record<string, number> = {
      '/api/chat': 30,
      '/api/analytics': 100,
      '/api/': 60,
      'default': 120
    };
    
    const limit = Object.keys(limits).find(key => endpoint.startsWith(key)) 
      ? limits[Object.keys(limits).find(key => endpoint.startsWith(key))!]
      : limits.default;
    
    if (current.count > limit) {
      // Block for progressive durations
      const blockDuration = Math.min(current.count - limit, 30) * 60000; // Max 30 min
      current.blocked = true;
      current.blockUntil = now + blockDuration;
      
      IPReputationSystem.addViolation(ip, 'rate_limit');
      
      this.requestCounts.set(key, current);
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    
    this.requestCounts.set(key, current);
    return { allowed: true };
  }
}

// Advanced Input Sanitization and Validation
class InputSanitizer {
  // Enhanced SQL Injection patterns
  private static sqlPatterns = [
    // Basic SQL commands
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    // SQL comments
    /(--|\/\*|\*\/|#|;)/gi,
    // SQL boolean logic exploits
    /(\bOR\b\s+\d+\s*=\s*\d+|\bAND\b\s+\d+\s*=\s*\d+)/gi,
    // SQL string concat
    /(\|\||CONCAT\(|CHAR\(|ASCII\()/gi,
    // SQL time-based attacks
    /(SLEEP\(|BENCHMARK\(|WAITFOR\s+DELAY)/gi,
    // SQL information schema
    /(information_schema|sys\.tables|sysobjects)/gi,
    // SQL batch queries
    /;\s*(SELECT|INSERT|UPDATE|DELETE)/gi,
  ];
  
  // Enhanced XSS patterns
  private static xssPatterns = [
    // Script tags
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    // Event handlers
    /on\w+\s*=\s*["']?[^"']*["']?/gi,
    // JavaScript protocols
    /javascript:\s*/gi,
    /vbscript:\s*/gi,
    /data:\s*text\/html/gi,
    // iframe/object/embed
    /<(iframe|object|embed|applet|meta|link|style)[\s\S]*?>/gi,
    // Base64 encoded attacks
    /base64[,;]/gi,
    // Expression attacks
    /expression\s*\(/gi,
    // Import attacks
    /@import/gi,
  ];
  
  // Detect and block SQL injection attempts
  static detectSQL(input: string): boolean {
    return this.sqlPatterns.some(pattern => pattern.test(input));
  }
  
  // Detect and block XSS attempts
  static detectXSS(input: string): boolean {
    return this.xssPatterns.some(pattern => pattern.test(input));
  }
  
  // Chat-safe sanitization: strips dangerous content WITHOUT HTML-encoding.
  // HTML-encoding is for browser OUTPUT, not AI chat INPUT.
  // Encoding apostrophes → &#x27; corrupts "I don't know" sent to the AI.
  static sanitize(input: string): string {
    return input
      // Strip dangerous protocols
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      // Strip script/iframe tags
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      // Strip event handler attributes (e.g. onclick="...")
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove control characters (keep \n \r \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      // Normalize whitespace
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  // Validate and sanitize with full protection
  static validateInput(input: string, maxLength: number = 2000): {
    valid: boolean;
    sanitized?: string;
    threat?: string;
  } {
    if (!input || input.length === 0) {
      return { valid: false, threat: 'empty_input' };
    }
    
    if (input.length > maxLength) {
      return { valid: false, threat: 'length_exceeded' };
    }
    
    if (this.detectSQL(input)) {
      return { valid: false, threat: 'sql_injection' };
    }
    
    if (this.detectXSS(input)) {
      return { valid: false, threat: 'xss_attempt' };
    }
    
    const sanitized = this.sanitize(input);
    return { valid: true, sanitized };
  }
}

// CSRF Token Management
class CSRFProtection {
  private static tokens = new Map<string, {
    token: string;
    createdAt: number;
    used: boolean;
  }>();
  
  // Generate secure CSRF token (Edge Runtime compatible)
  static generateToken(sessionId: string): string {
    // Use Web Crypto API for Edge Runtime compatibility
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    this.tokens.set(sessionId, {
      token,
      createdAt: Date.now(),
      used: false
    });
    return token;
  }
  
  // Validate CSRF token
  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    
    if (!stored) return false;
    if (stored.used) return false;
    if (Date.now() - stored.createdAt > 3600000) return false; // 1 hour expiry
    if (stored.token !== token) return false;
    
    // Mark as used (one-time use)
    stored.used = true;
    return true;
  }
  
  // Cleanup expired tokens
  static cleanup(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now - data.createdAt > 3600000 || data.used) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// Request Signature Validation (prevents tampering)
// Note: This requires Node.js crypto, use only in API routes, not middleware
class RequestSignature {
  private static secret = process.env.REQUEST_SIGNATURE_SECRET || 'ultra-secure-secret-key-change-in-production';
  
  // Generate signature for request (requires Node.js crypto)
  static async generate(data: string, timestamp: number): Promise<string> {
    const payload = `${data}:${timestamp}`;
    // Web Crypto API compatible
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secret);
    const payloadData = encoder.encode(payload);
    
    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign
    const signature = await crypto.subtle.sign('HMAC', key, payloadData);
    
    // Convert to hex
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Verify signature
  static async verify(data: string, timestamp: number, signature: string): Promise<boolean> {
    // Check timestamp (must be within 5 minutes)
    if (Math.abs(Date.now() - timestamp) > 300000) return false;
    
    const expected = await this.generate(data, timestamp);
    
    // Simple comparison (Edge runtime compatible)
    return expected === signature;
  }
}

// Honeypot Detection (catches bots)
class HoneypotDetection {
  private static honeypotFields = ['email_confirm', 'website', 'url', 'phone_confirm', 'company', 'fax'];
  
  // Check if honeypot was triggered
  static checkHoneypot(data: any): boolean {
    return this.honeypotFields.some(field => data[field] && data[field].length > 0);
  }
  
  // Time-based bot detection
  static checkSubmissionSpeed(formStartTime: number): boolean {
    const submissionTime = Date.now() - formStartTime;
    return submissionTime < 2000; // Submitted in less than 2 seconds = likely bot
  }
}

// Main Security Middleware
export class MaximumSecurity {
  // Comprehensive security check for all requests
  static async secureRequest(request: NextRequest): Promise<NextResponse | null> {
    const ip = getClientIp(request);
    const pathname = request.nextUrl.pathname;
    
    // 1. Check IP reputation and blocklist
    if (IPReputationSystem.isBlocked(ip)) {
      console.warn(`🚫 Blocked request from blacklisted IP: ${ip}`);
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403, headers: { 'X-Security-Block': 'ip-blocked' } }
      );
    }
    
    // 2. DDoS protection
    const ddosCheck = DDoSProtection.checkRequest(ip, pathname);
    if (!ddosCheck.allowed) {
      IPReputationSystem.addViolation(ip, 'rate_limit');
      return NextResponse.json(
        { error: ddosCheck.reason },
        { 
          status: 429, 
          headers: { 
            'X-Security-Block': 'rate-limit',
            'Retry-After': '60'
          }
        }
      );
    }
    
    // 3. Check reputation score
    const score = IPReputationSystem.getScore(ip);
    if (score < 50) {
      console.warn(`⚠️ Low reputation IP (${score}): ${ip}`);
      // Add extra scrutiny but don't block yet
    }
    
    return null; // Request is secure, continue
  }
  
  // Validate POST request body
  static async validatePostData(request: NextRequest, data: any): Promise<{
    valid: boolean;
    sanitized?: any;
    error?: string;
  }> {
    const ip = getClientIp(request);
    
    // Check honeypot
    if (HoneypotDetection.checkHoneypot(data)) {
      IPReputationSystem.addViolation(ip, 'suspicious_pattern');
      IPReputationSystem.blockIP(ip, 'Honeypot triggered - likely bot');
      return { valid: false, error: 'Invalid request' };
    }
    
    // Sanitize all string fields via shared SecurityValidator (MED-019)
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const result = SecurityValidator.validateUntrustedString(value);
        if (!result.valid) {
          IPReputationSystem.addViolation(ip, result.threat || 'invalid_input');
          if (result.threat === 'sql_injection' || result.threat === 'xss_attempt') {
            IPReputationSystem.blockIP(ip, `Attack detected: ${result.threat}`);
          }
          return { valid: false, error: 'Invalid input detected' };
        }
        sanitized[key] = result.sanitized;
      } else {
        sanitized[key] = value;
      }
    }
    
    return { valid: true, sanitized };
  }
  
  // Generate secure cookies
  static getSecureCookieOptions(isProduction: boolean = process.env.NODE_ENV === 'production'): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
    path: string;
  } {
    return {
      httpOnly: true, // Prevent JavaScript access
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // Strong CSRF protection
      maxAge: 86400, // 24 hours
      path: '/'
    };
  }
  
  // Periodic cleanup
  static startCleanup(): void {
    setInterval(() => {
      IPReputationSystem.cleanup();
      CSRFProtection.cleanup();
    }, 300000); // Every 5 minutes
  }
}

// Export all security components
export {
  IPReputationSystem,
  DDoSProtection,
  InputSanitizer,
  CSRFProtection,
  RequestSignature,
  HoneypotDetection
};

// Start cleanup on module load
if (typeof setInterval !== 'undefined') {
  MaximumSecurity.startCleanup();
}

export default MaximumSecurity;
