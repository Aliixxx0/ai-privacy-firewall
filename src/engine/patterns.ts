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
  minLength: 3,
};

const PATTERNS: Record<string, PatternConfig> = {
  email: {
    // @g/@h domains (incl. partial while typing) and domains containing edu, gov, or sa
    pattern:
      /(?:[a-zA-Z0-9._%+-]+@(?:[gh][a-zA-Z0-9.-]*|[a-zA-Z0-9.-]*(?:edu|gov|sa)[a-zA-Z0-9.-]*))/gi,
    confidence: 0.95,
    minLength: 4,
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
    pattern: /(?<!\d)966[\s-]?5\d{0,8}(?!\d)/g,
    ...PHONE_CONFIG,
  },
  saudiPhoneLocal: {
    // 051–059 without requiring "phone number" context
    pattern: /(?<!\d)05(?:[\s-]*\d+){1,3}(?!\d)/g,
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

const LABELED_ID_10_PATTERN =
  /\bID\b\s*(?:is|:|=|>|<)\s*["']?(\d{10})["']?/gi;

const LABELED_SECRET_PATTERN =
  /(?:\bKEY\b|[\w-]+(?:[\s_-]+)*KEY|[\w-]+_ID)\s*(?:is|:|=|>|<)\s*["']?([^\s"']+)["']?/gi;

const PHONE_TYPES = new Set([
  "saudiPhonePlus",
  "saudiPhone9665",
  "saudiPhone966",
  "saudiPhoneLocal",
]);

function isValidLocalPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^05[1-9]\d{0,8}$/.test(digits);
}

function trimTrailingEmailPunctuation(text: string): string {
  return text.replace(/[.,;:!?)]+$/, "");
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

  if (
    config?.preserveLengthMask ||
    detection.type === "password" ||
    detection.type === "labeledSecret" ||
    detection.type === "labeledId"
  ) {
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

function detectValueAfterLabel(
  text: string,
  pattern: RegExp,
  type: Detection["type"],
  confidence: number,
): Detection[] {
  const detections: Detection[] = [];

  for (const match of text.matchAll(pattern)) {
    const value = match[1];
    if (!value || value.length < 2) {
      continue;
    }

    const valueStart = match.index! + match[0].lastIndexOf(value);
    detections.push({
      type,
      text: value,
      confidence,
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
      let matched = match[0];
      let start = match.index || 0;
      let end = start + matched.length;

      if (type === "email") {
        const trimmed = trimTrailingEmailPunctuation(matched);
        if (trimmed.length < matched.length) {
          matched = trimmed;
          end = start + matched.length;
        }
      }

      if (type === "saudiPhoneLocal" && !isValidLocalPhone(matched)) {
        continue;
      }

      if (matched.length >= minLength) {
        detections.push({
          type,
          text: matched,
          confidence: config.confidence,
          start,
          end,
        });
      }
    }
  }

  detections.push(
    ...detectValueAfterLabel(text, PASSWORD_VALUE_PATTERN, "password", 0.85),
  );
  detections.push(
    ...detectValueAfterLabel(text, LABELED_SECRET_PATTERN, "labeledSecret", 0.88),
  );
  detections.push(
    ...detectValueAfterLabel(text, LABELED_ID_10_PATTERN, "labeledId", 0.9),
  );

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
