import type { Detection, RedactionStrategy } from "~src/types";

// Ultra-compressed regex patterns
const PATTERNS = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.95,
  },
  jwt: {
    pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
    confidence: 0.98,
  },
  apiKey: {
    pattern: /(?:sk|pk|ghp)[-\w]{20,}/g,
    confidence: 0.9,
  },
  bearerToken: {
    pattern: /Bearer\s+[a-zA-Z0-9\-_.]+/gi,
    confidence: 0.85,
  },
  creditCard: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    confidence: 0.9,
  },
  awsKey: {
    pattern: /AKIA[0-9A-Z]{16}/g,
    confidence: 0.99,
  },
  password: {
    pattern: /password\s*[:=]\s*["']?[\w!@#$%^&*]+["']?/gi,
    confidence: 0.75,
  },
};

export function detectSecrets(text: string): Detection[] {
  const detections: Detection[] = [];
  
  for (const [type, config] of Object.entries(PATTERNS)) {
    const matches = [...text.matchAll(config.pattern)];
    
    for (const match of matches) {
      if (match[0].length > 5) { // Skip short strings
        detections.push({
          type,
          text: match[0],
          confidence: config.confidence,
          start: match.index || 0,
          end: (match.index || 0) + match[0].length,
        });
      }
    }
  }
  
  return detections;
}

export function sanitize(text: string, strategy: RedactionStrategy = 'mask'): string {
  const detections = detectSecrets(text);
  if (detections.length === 0) return text;
  
  let result = text;
  
  // Sort by position descending to avoid position shifts
  detections.sort((a, b) => b.start - a.start);
  
  for (const detection of detections) {
    const replacement = strategy === 'mask' ? '****' : 
                       strategy === 'hash' ? hashString(detection.text).slice(0, 8) :
                       '';
    
    result = result.slice(0, detection.start) + replacement + result.slice(detection.end);
  }
  
  return result;
}

function hashString(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
  }
  return Math.abs(hash).toString(16);
}