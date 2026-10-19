
import crypto from 'crypto';

// Comprehensive security utilities for enterprise-grade protection
export class SecurityValidator {
  // Rate limiting for messages with adaptive throttling
  private static messageRateLimit = new Map<string, number[]>();
  private static suspiciousIPs = new Map<string, { attempts: number; lastAttempt: number }>();
  private static blockedIPs = new Set<string>();
  
  // SQL injection patterns — no /g flag (stateful lastIndex breaks cross-request .test())
  private static sqlInjectionPatterns = [
    /\b(union\s+select)\b/i,
    /\bselect\b[^\n]{0,120}\bfrom\b/i,
    /\binsert\s+into\b/i,
    /\bupdate\s+\w+\s+set\b/i,
    /\bdelete\s+from\b/i,
    /\bdrop\s+table\b/i,
  ];

  // XSS patterns — no /g flag for the same reason
  private static xssPatterns = [
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe[^>]*>.*?<\/iframe>/i,
    /<object[^>]*>.*?<\/object>/i,
    /<embed[^>]*>/i,
    /expression\s*\(/i,
    /vbscript:/i,
  ];

  private static testPattern(pattern: RegExp, input: string): boolean {
    pattern.lastIndex = 0;
    return pattern.test(input);
  }

  // Advanced input validation with security layers
  static validateMessageInput(message: string, userId: string = 'anonymous', clientIP?: string): {
    isValid: boolean;
    reason?: string;
    sanitized?: string;
    securityLevel?: 'safe' | 'suspicious' | 'blocked';
  } {
    // Check if IP is blocked
    if (clientIP && this.blockedIPs.has(clientIP)) {
      return { isValid: false, reason: 'Access denied.', securityLevel: 'blocked' };
    }

    // Rate limiting with progressive penalties
    if (!this.checkRateLimit(userId, clientIP)) {
      return { isValid: false, reason: 'Rate limit exceeded. Please slow down.', securityLevel: 'suspicious' };
    }
    
    // Basic validation
    if (message.length > 2000) {
      this.flagSuspiciousActivity(clientIP);
      return { isValid: false, reason: 'Message too long. Maximum 2000 characters.' };
    }
    
    if (message.trim().length === 0) {
      return { isValid: false, reason: 'Message cannot be empty.' };
    }

    // Security threat detection
    if (this.detectSQLInjection(message)) {
      this.flagSuspiciousActivity(clientIP, 'sql_injection');
      return { isValid: false, reason: 'Invalid input detected.', securityLevel: 'blocked' };
    }

    if (this.detectXSSAttempt(message)) {
      this.flagSuspiciousActivity(clientIP, 'xss_attempt');
      return { isValid: false, reason: 'Invalid input detected.', securityLevel: 'blocked' };
    }

    // Advanced sanitization
    const sanitized = this.advancedSanitization(message);
    
    // Spam and content validation
    if (this.detectAdvancedSpam(sanitized)) {
      this.flagSuspiciousActivity(clientIP);
      return { isValid: false, reason: 'Message appears to be spam.', securityLevel: 'suspicious' };
    }
    
    // Content filtering
    if (this.containsInappropriateContent(sanitized)) {
      return { isValid: false, reason: 'Message contains inappropriate content.' };
    }
    
    return { isValid: true, sanitized, securityLevel: 'safe' };
  }

  // Enhanced rate limiting with IP tracking
  private static checkRateLimit(userId: string, clientIP?: string): boolean {
    const now = Date.now();
    const userLimits = this.messageRateLimit.get(userId) || [];
    
    // Clean old entries
    const recentLimits = userLimits.filter(timestamp => now - timestamp < 60000);
    
    // Check for suspicious IP activity
    if (clientIP && this.suspiciousIPs.has(clientIP)) {
      const suspiciousData = this.suspiciousIPs.get(clientIP)!;
      if (suspiciousData.attempts > 10 && now - suspiciousData.lastAttempt < 300000) { // 5 min cooldown
        return false;
      }
    }
    
    // Adaptive rate limiting based on suspicion level
    const maxRequests = this.suspiciousIPs.has(clientIP || userId) ? 15 : 30;
    
    if (recentLimits.length >= maxRequests) {
      this.flagSuspiciousActivity(clientIP);
      return false;
    }
    
    recentLimits.push(now);
    this.messageRateLimit.set(userId, recentLimits);
    return true;
  }

  // SQL injection detection
  private static detectSQLInjection(input: string): boolean {
    return this.sqlInjectionPatterns.some(pattern => this.testPattern(pattern, input));
  }

  // XSS attempt detection
  private static detectXSSAttempt(input: string): boolean {
    return this.xssPatterns.some(pattern => this.testPattern(pattern, input));
  }

  // Chat-safe sanitization: strips dangerous code WITHOUT HTML-encoding.
  // HTML-encoding is for browser output, NOT for AI chat input.
  // Encoding apostrophes (') → &#x27; corrupts "I don't know" into garbled text for the AI.
  private static advancedSanitization(input: string): string {
    return input
      // Strip dangerous protocols
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      // Strip script tags and event handler attributes
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove control characters (keep \n, \r, \t for readability)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  // Spam detection — designed NOT to false-positive on Indian-language messages.
  // Indian scripts (Kannada, Tamil, Telugu, etc.) contain non-ASCII chars that naive
  // [^\w\s]{5,} patterns would flag as "too many special characters". This is wrong.
  private static detectAdvancedSpam(message: string): boolean {
    const spamPatterns = [
      /(.)\1{15,}/i, // Extremely repeated characters (raised from 10 → 15)
      /https?:\/\/[^\s]+/gi, // URLs in messages
      /\b(buy now|click here|free money|earn \$|lottery|winner|viagra|casino)\b/gi,
      // Only flag excessive ASCII punctuation/symbols — NOT Unicode letters from Indian scripts.
      /[!"$%^&*()\-+=[\]{};:@~<>?,|\\]{6,}/,
      /\b\d{4,}\b.*\b\d{4,}\b/gi, // Multiple long numbers (phone/credit card patterns)
    ];

    return spamPatterns.some(pattern => {
      try {
        return pattern.test(message);
      } catch {
        return false;
      }
    });
  }

  // Content filtering (keeping it reasonable for AI girlfriend context)
  private static containsInappropriateContent(message: string): boolean {
    const inappropriatePatterns = [
      /\b(explicit_violent_content|extreme_profanity)\b/gi,
      // Keep minimal for AI girlfriend context - most content should be allowed
    ];
    
    return inappropriatePatterns.some(pattern => pattern.test(message));
  }

  // Flag suspicious activity for monitoring
  private static flagSuspiciousActivity(clientIP?: string, type: string = 'general'): void {
    if (!clientIP) return;
    
    const current = this.suspiciousIPs.get(clientIP) || { attempts: 0, lastAttempt: 0 };
    current.attempts += type === 'sql_injection' || type === 'xss_attempt' ? 5 : 1;
    current.lastAttempt = Date.now();
    
    this.suspiciousIPs.set(clientIP, current);
    
    // Auto-block after severe violations
    if (current.attempts > 20 || (type === 'sql_injection' || type === 'xss_attempt')) {
      this.blockedIPs.add(clientIP);
    }
  }

  // Enhanced file upload validation
  static validateFileUpload(file: File, allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']): { 
    isValid: boolean; 
    reason?: string; 
    securityLevel?: string;
  } {
    // File size check (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { isValid: false, reason: 'File too large. Maximum size is 5MB.' };
    }
    
    // File type validation
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, reason: 'Invalid file type.', securityLevel: 'suspicious' };
    }
    
    // File name validation
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      return { isValid: false, reason: 'Invalid file name characters.', securityLevel: 'suspicious' };
    }
    
    // Check for double extensions (potential malware)
    if ((file.name.match(/\./g) || []).length > 1) {
      return { isValid: false, reason: 'Invalid file format.', securityLevel: 'blocked' };
    }
    
    return { isValid: true, securityLevel: 'safe' };
  }

  // Secure CSRF token generation
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /** Generic untrusted string validation — shared by enhanced-security (MED-019). */
  static validateUntrustedString(input: string, maxLength = 2000): {
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
    if (this.detectSQLInjection(input)) {
      return { valid: false, threat: 'sql_injection' };
    }
    if (this.detectXSSAttempt(input)) {
      return { valid: false, threat: 'xss_attempt' };
    }
    return { valid: true, sanitized: this.advancedSanitization(input) };
  }

  // Constant-time CSRF token validation
  static validateCSRFToken(token: string, expectedToken: string): boolean {
    if (token.length !== expectedToken.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }

  // API key validation
  static validateAPIKey(apiKey: string): boolean {
    const apiKeyPattern = /^[a-zA-Z0-9_-]{32,128}$/;
    return apiKeyPattern.test(apiKey);
  }

  // Password strength validation
  static validatePasswordStrength(password: string): { 
    isValid: boolean; 
    score: number; 
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;
    
    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters');
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include numbers');
    
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Include special characters');
    
    return {
      isValid: score >= 4,
      score,
      feedback
    };
  }

  // Clean up expired entries
  static cleanup(): void {
    const now = Date.now();
    
    // Clean rate limits
    for (const [key, timestamps] of this.messageRateLimit.entries()) {
      const recent = timestamps.filter(t => now - t < 300000); // 5 min
      if (recent.length === 0) {
        this.messageRateLimit.delete(key);
      } else {
        this.messageRateLimit.set(key, recent);
      }
    }
    
    // Clean suspicious IPs
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (now - data.lastAttempt > 3600000) { // 1 hour
        this.suspiciousIPs.delete(ip);
      }
    }
  }

  // Hard bounds for client-supplied chat history — enforced BEFORE any
  // per-item processing so an attacker cannot abuse CPU/memory with an
  // enormous array. All bounds are checked before `.slice()`, and the slice
  // happens before any sanitization/iteration work.
  private static readonly MAX_HISTORY_ITEMS = 20;
  private static readonly MAX_HISTORY_ITEM_CHARS = 600;
  private static readonly MAX_HISTORY_TOTAL_CHARS = 12_000; // 20 × 600

  /**
   * Validate and bound a client-supplied `history` array.
   *
   * Enforcement order (cheap checks first, nothing iterates the whole array):
   *   1. must be an array
   *   2. length <= 20
   *   3. each item must be a string <= 600 chars
   *   4. total chars <= 12 KB
   *
   * On any violation the whole payload is rejected (valid=false) rather than
   * silently truncated — an out-of-bounds history is treated as abuse.
   */
  static sanitizeHistory(history: unknown): {
    valid: boolean;
    sanitized?: string[];
    reason?: string;
  } {
    if (history === undefined || history === null) {
      return { valid: true, sanitized: [] };
    }

    if (!Array.isArray(history)) {
      return { valid: false, reason: 'History must be an array' };
    }

    if (history.length > this.MAX_HISTORY_ITEMS) {
      return { valid: false, reason: 'History too long' };
    }

    const sanitized: string[] = [];
    let totalChars = 0;

    for (const item of history) {
      if (typeof item !== 'string') {
        return { valid: false, reason: 'History items must be strings' };
      }
      if (item.length > this.MAX_HISTORY_ITEM_CHARS) {
        return { valid: false, reason: 'History item too long' };
      }
      totalChars += item.length;
      if (totalChars > this.MAX_HISTORY_TOTAL_CHARS) {
        return { valid: false, reason: 'History too large' };
      }
      sanitized.push(item);
    }

    return { valid: true, sanitized };
  }
}

export default SecurityValidator;
