import { describe, expect, test } from "bun:test";

import { detectSecrets, sanitize } from "./patterns";
import {
  EmptyMessageError,
  isEmptyAfterRedaction,
  sanitizeDeep,
  sanitizePayload,
} from "./sanitize-payload";

describe("detectSecrets - email", () => {
  const cases = [
    "contact me at user@example.com today",
    "send to admin@company.co.uk",
    "mixed USER+tag@domain.io and text",
  ];

  for (const input of cases) {
    test(`detects email in: ${input}`, () => {
      const detections = detectSecrets(input);
      expect(detections.some((d) => d.type === "email")).toBe(true);
    });
  }

  test("does not detect invalid email", () => {
    expect(detectSecrets("not-an-email@").some((d) => d.type === "email")).toBe(
      false,
    );
  });
});

describe("detectSecrets - saudiPhone", () => {
  const validCases = [
    { input: "mobile 0512345678", expected: "0512345678" },
    { input: "mobile 05 1234 5678", expected: "05 1234 5678" },
    { input: "mobile 05-1234-5678", expected: "05-1234-5678" },
    { input: "intl +966512345678", expected: "+966512345678" },
    { input: "intl +966 512345678", expected: "+966 512345678" },
    { input: "intl 966512345678", expected: "966512345678" },
    { input: "intl 966 512345678", expected: "966 512345678" },
    { input: "call +966551234567 please", expected: "+966551234567" },
  ];

  for (const { input, expected } of validCases) {
    test(`detects ${expected} in "${input}"`, () => {
      const detections = detectSecrets(input);
      const phone = detections.find((d) => d.type === "saudiPhone");
      expect(phone?.text).toBe(expected);
    });
  }

  const invalidCases = [
    "051234567", // too short
    "05123456789", // too long
    "0612345678", // wrong prefix
    "1234567890", // not saudi format
    "order id 966512345678901234", // embedded in longer number
  ];

  for (const input of invalidCases) {
    test(`ignores invalid phone: ${input}`, () => {
      expect(detectSecrets(input).some((d) => d.type === "saudiPhone")).toBe(
        false,
      );
    });
  }
});

describe("detectSecrets - apiKey", () => {
  test("detects OpenAI sk key", () => {
    const key = "sk-12345678901234567890123456789012";
    const detections = detectSecrets(`use key ${key} here`);
    expect(detections.some((d) => d.type === "apiKey" && d.text === key)).toBe(
      true,
    );
  });

  test("detects GitHub ghp key", () => {
    const key = "ghp_1234567890123456789012345678901234567890";
    const detections = detectSecrets(`token ${key}`);
    expect(detections.some((d) => d.type === "apiKey")).toBe(true);
  });
});

describe("detectSecrets - jwt", () => {
  test("detects jwt token", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_here_1234567890";
    expect(detectSecrets(`auth ${jwt}`).some((d) => d.type === "jwt")).toBe(true);
  });
});

describe("detectSecrets - awsKey", () => {
  test("detects AWS access key", () => {
    const key = "AKIAIOSFODNN7EXAMPLE";
    expect(
      detectSecrets(`aws ${key}`).some((d) => d.type === "awsKey" && d.text === key),
    ).toBe(true);
  });
});

describe("detectSecrets - creditCard", () => {
  test("detects spaced credit card", () => {
    const card = "4111 1111 1111 1111";
    expect(detectSecrets(`pay ${card}`).some((d) => d.type === "creditCard")).toBe(
      true,
    );
  });
});

describe("detectSecrets - password", () => {
  test("detects password assignment", () => {
    expect(
      detectSecrets('config password="S3cret!"').some((d) => d.type === "password"),
    ).toBe(true);
  });
});

describe("detectSecrets - bearerToken", () => {
  test("detects bearer token", () => {
    expect(
      detectSecrets("Authorization: Bearer abc123.def456").some(
        (d) => d.type === "bearerToken",
      ),
    ).toBe(true);
  });
});

describe("detectSecrets - deduplication", () => {
  test("does not double-detect overlapping matches", () => {
    const detections = detectSecrets("0512345678");
    expect(detections.filter((d) => d.type === "saudiPhone")).toHaveLength(1);
  });
});

describe("sanitize - masking behavior", () => {
  test("masks email with short placeholder", () => {
    expect(sanitize("email test@example.com")).toBe("email ****");
  });

  test("masks api key with short placeholder", () => {
    const key = "sk-12345678901234567890123456789012";
    expect(sanitize(`key ${key}`)).toBe("key ****");
  });

  test("masks saudi phone with length-preserving asterisks", () => {
    expect(sanitize("phone 0512345678")).toBe("phone **********");
    expect(sanitize("phone 05 1234 5678")).toBe("phone ************");
    expect(sanitize("phone +966512345678")).toBe("phone *************");
  });

  test("masks credit card with length-preserving asterisks", () => {
    const card = "4111 1111 1111 1111";
    expect(sanitize(`card ${card}`)).toBe(`card ${"*".repeat(card.length)}`);
  });

  test("masks multiple secret types in one message", () => {
    const input =
      "email test@example.com phone 0512345678 key sk-12345678901234567890123456789012";
    const output = sanitize(input);

    expect(output).toContain("****");
    expect(output).toContain("**********");
    expect(output).not.toContain("test@example.com");
    expect(output).not.toContain("0512345678");
    expect(output).not.toContain("sk-12345678901234567890123456789012");
  });

  test("returns original text when no secrets found", () => {
    const input = "hello world, no secrets here";
    expect(sanitize(input)).toBe(input);
  });

  test("remove strategy strips detections", () => {
    expect(sanitize("email test@example.com", "remove")).toBe("email ");
  });

  test("hash strategy replaces with hex hash prefix", () => {
    const output = sanitize("email test@example.com", "hash");
    expect(output.startsWith("email ")).toBe(true);
    expect(output).not.toContain("test@example.com");
    expect(output.split(" ")[1]?.length).toBe(8);
  });
});

describe("sanitizePayload - claude api bodies", () => {
  test("redacts message_content only", () => {
    const body = JSON.stringify({
      message_content: "email test@example.com phone 0512345678",
      context_token: "abc-session-token",
      conversation_id: "uuid-1234-5678",
    });

    const result = JSON.parse(sanitizePayload(body));

    expect(result.message_content).toBe("email **** phone **********");
    expect(result.context_token).toBe("abc-session-token");
    expect(result.conversation_id).toBe("uuid-1234-5678");
  });

  test("redacts nested message content fields", () => {
    const body = JSON.stringify({
      messages: [
        {
          role: "user",
          content: "use key sk-12345678901234567890123456789012 please",
        },
      ],
      session_id: "keep-me",
    });

    const result = JSON.parse(sanitizePayload(body));

    expect(result.messages[0].content).toBe("use key **** please");
    expect(result.session_id).toBe("keep-me");
  });

  test("throws when nested message content is only secrets", () => {
    const body = JSON.stringify({
      messages: [{ role: "user", content: "sk-12345678901234567890123456789012" }],
    });

    expect(() => sanitizePayload(body)).toThrow(EmptyMessageError);
  });

  test("throws when message is only secrets", () => {
    const body = JSON.stringify({
      message_content: "test@example.com",
    });

    expect(() => sanitizePayload(body)).toThrow(EmptyMessageError);
  });

  test("allows mixed message after redaction", () => {
    const body = JSON.stringify({
      message_content: "my email is test@example.com thanks",
    });

    const result = JSON.parse(sanitizePayload(body));
    expect(result.message_content).toBe("my email is **** thanks");
  });

  test("sanitizes plain text bodies", () => {
    expect(sanitizePayload("phone 0512345678")).toBe("phone **********");
  });
});

describe("isEmptyAfterRedaction", () => {
  test("detects asterisk-only content as empty", () => {
    expect(isEmptyAfterRedaction("****")).toBe(true);
    expect(isEmptyAfterRedaction("**********")).toBe(true);
    expect(isEmptyAfterRedaction("  ****  ")).toBe(true);
  });

  test("detects mixed content as non-empty", () => {
    expect(isEmptyAfterRedaction("hello ****")).toBe(false);
    expect(isEmptyAfterRedaction("**** world")).toBe(false);
  });
});

describe("sanitizeDeep", () => {
  test("leaves non-message keys untouched", () => {
    const result = sanitizeDeep({
      context_token: "secret-looking-but-kept",
      message_content: "test@example.com",
    });

    expect(result).toEqual({
      context_token: "secret-looking-but-kept",
      message_content: "****",
    });
  });
});
