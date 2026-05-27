import type { Detection, RedactionStrategy } from "~src/types";

type PatternConfig = {
  pattern: RegExp;
  confidence: number;
  preserveLengthMask?: boolean;
  minLength?: number;
};

const PHONE_CONFIG: Omit<PatternConfig, "pattern"> = {
  confidence: 0.92,
  preserveLengthMask: true,
  minLength: 4,
};

const PATTERNS: Record<string, PatternConfig> = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.95,
  },
  saudiPhonePlus: {
    pattern: /\+966[\s-]?\d{0,9}/g,
    ...PHONE_CONFIG,
  },
  saudiPhone9665: {
    pattern: /(?<!\d)9665\d{0,8}(?!\d)/g,
    ...PHONE_CONFIG,
  },
  saudiPhone966: {
    pattern: /(?<!\d)966[\s-]5\d{0,8}(?!\d)/g,
    ...PHONE_CONFIG,
  },
  saudiNationalId: {
    pattern: /(?<!\d)1\d{0,9}(?!\d)/g,
    confidence: 0.9,
    preserveLengthMask: true,
    minLength: 4,
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
};

const PASSWORD_VALUE_PATTERN =
  /(?:passw(?:ord)?)\s*(?:is|:|=|>|<)\s*["']?([^\s"']+)["']?/gi;

const PHONE_TYPES = new Set([
  "saudiPhonePlus",
  "saudiPhone9665",
  "saudiPhone966",
  "saudiPhoneLocal",
]);

const CONTEXT_PHONE_PATTERN = /(?:phone\s*number|number)/gi;
const LOCAL_PHONE_PATTERN = /05(?:[\s-]*\d+){1,3}(?!\d)/g;

function detectContextualLocalPhones(text: string): Detection[] {
  const detections: Detection[] = [];
  const contextMatches: RegExpMatchArray[] = [];

  for (const match of text.matchAll(CONTEXT_PHONE_PATTERN)) {
    if (match[0].toLowerCase() === "number") {
      const before = text.slice(Math.max(0, match.index! - 6), match.index!);
      if (/phone\s*$/i.test(before)) {
        continue;
      }
    }
    contextMatches.push(match);
  }

  for (let i = 0; i < contextMatches.length; i++) {
    const contextMatch = contextMatches[i];
    const sliceStart = contextMatch.index! + contextMatch[0].length;
    const sliceEnd = contextMatches[i + 1]?.index ?? text.length;
    const slice = text.slice(sliceStart, sliceEnd);

    for (const phoneMatch of slice.matchAll(LOCAL_PHONE_PATTERN)) {
      const value = phoneMatch[0];
      if (value.length < 2) {
        continue;
      }

      const start = sliceStart + (phoneMatch.index || 0);
      detections.push({
        type: "saudiPhoneLocal",
        text: value,
        confidence: PHONE_CONFIG.confidence,
        start,
        end: start + value.length,
      });
    }
  }

  return detections;
}

function maskDetection(
  detection: Detection,
  strategy: RedactionStrategy,
  config?: PatternConfig,
): string {
  if (strategy === "hash") {
    return hashString(detection.text).slice(0, 8);
  }

  if (strategy === "remove") {
    return "";
  }

  if (config?.preserveLengthMask || detection.type === "password") {
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
    const overlapIndex = kept.findIndex(
      (existing) =>
        detection.start < existing.end && detection.end > existing.start,
    );

    if (overlapIndex === -1) {
      kept.push(detection);
      continue;
    }

    const existing = kept[overlapIndex];
    if (detection.end - detection.start > existing.end - existing.start) {
      kept[overlapIndex] = detection;
    }
  }

  return kept;
}

function detectPasswordValues(text: string): Detection[] {
  const detections: Detection[] = [];

  for (const match of text.matchAll(PASSWORD_VALUE_PATTERN)) {
    const value = match[1];
    if (!value || value.length < 2) {
      continue;
    }

    const valueStart = match.index! + match[0].lastIndexOf(value);
    detections.push({
      type: "password",
      text: value,
      confidence: 0.85,
      start: valueStart,
      end: valueStart + value.length,
    });
  }

  return detections;
}

export function detectSecrets(text: string): Detection[] {
  const detections: Detection[] = [];

  for (const [type, config] of Object.entries(PATTERNS)) {
    const minLength = config.minLength ?? 6;

    for (const match of text.matchAll(config.pattern)) {
      if (match[0].length >= minLength) {
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

  detections.push(...detectPasswordValues(text));
  detections.push(...detectContextualLocalPhones(text));

  return dedupeDetections(detections);
}

export function isPhoneDetection(type: string): boolean {
  return PHONE_TYPES.has(type) || type.startsWith("saudiPhone");
}

export function sanitize(text: string, strategy: RedactionStrategy = "mask"): string {
  const detections = detectSecrets(text);
  if (detections.length === 0) {
    return text;
  }

  let result = text;

  detections.sort((a, b) => b.start - a.start);

  for (const detection of detections) {
    const config =
      PATTERNS[detection.type] ??
      (isPhoneDetection(detection.type)
        ? ({ ...PHONE_CONFIG, pattern: /./ } as PatternConfig)
        : undefined);
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
