import type { Detection, RedactionStrategy } from "~src/types";

type PatternConfig = {
  pattern: RegExp;
  confidence: number;
  preserveLengthMask?: boolean;
};

// Ultra-compressed regex patterns
const PATTERNS: Record<string, PatternConfig> = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.95,
  },
  saudiPhone: {
    pattern:
      /(?:\+9665\d{8}|\+966[\s-]5\d{8}|(?<!\d)9665\d{8}(?!\d)|(?<!\d)966[\s-]5\d{8}(?!\d)|\b05(?:[\s-]?\d{4}){2}\b|\b05\d{8}\b)/g,
    confidence: 0.92,
    preserveLengthMask: true,
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
    preserveLengthMask: true,
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

function maskDetection(
  detection: Detection,
  strategy: RedactionStrategy,
  config: PatternConfig,
): string {
  if (strategy === "hash") {
    return hashString(detection.text).slice(0, 8);
  }

  if (strategy === "remove") {
    return "";
  }

  if (config.preserveLengthMask) {
    return "*".repeat(detection.text.length);
  }

  return "****";
}

function dedupeDetections(detections: Detection[]): Detection[] {
  const sorted = [...detections].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return b.end - b.start - (a.end - a.start);
  });

  const kept: Detection[] = [];

  for (const detection of sorted) {
    const overlaps = kept.some(
      (existing) =>
        detection.start < existing.end && detection.end > existing.start,
    );

    if (!overlaps) {
      kept.push(detection);
    }
  }

  return kept;
}

export function detectSecrets(text: string): Detection[] {
  const detections: Detection[] = [];

  for (const [type, config] of Object.entries(PATTERNS)) {
    const matches = [...text.matchAll(config.pattern)];

    for (const match of matches) {
      if (match[0].length > 5) {
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

  return dedupeDetections(detections);
}

export function sanitize(text: string, strategy: RedactionStrategy = "mask"): string {
  const detections = detectSecrets(text);
  if (detections.length === 0) {
    return text;
  }

  let result = text;

  detections.sort((a, b) => b.start - a.start);

  for (const detection of detections) {
    const config = PATTERNS[detection.type];
    const replacement = maskDetection(detection, strategy, config);

    result =
      result.slice(0, detection.start) + replacement + result.slice(detection.end);
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