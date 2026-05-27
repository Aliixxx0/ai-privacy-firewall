import { describe, expect, test } from "bun:test";

import { detectSecrets, isPhoneDetection, sanitize } from "./patterns";
import {
  EmptyMessageError,
  bodyToText,
  isAiChatHost,
  isEmptyAfterRedaction,
  looksLikeChatPayload,
  sanitizeDeep,
  sanitizePayload,
  shouldSanitizeRequest,
  textToBody,
} from "./sanitize-payload";

function findPhone(input: string) {
  return detectSecrets(input).find((d) => isPhoneDetection(d.type));
}

function findPhones(input: string) {
  return detectSecrets(input).filter((d) => isPhoneDetection(d.type));
}

describe("detectSecrets - email", () => {
  const cases = [
    { input: "contact me at user@gmail.com today", domain: "gmail" },
    { input: "send to admin@company.gov.sa", domain: "gov.sa" },
    { input: "mixed USER+tag@school.edu and text", domain: "edu" },
    { input: "reach me at ali@hotmail.com", domain: "hotmail" },
    { input: "partial while typing john@g", domain: "@g" },
  ];

  for (const { input, domain } of cases) {
    test(`detects sensitive email (${domain}) in: ${input}`, () => {
      expect(detectSecrets(input).some((d) => d.type === "email")).toBe(true);
    });
  }

  test("does not detect generic example.com email", () => {
    expect(detectSecrets("contact test@example.com").some((d) => d.type === "email")).toBe(
      false,
    );
  });

  test("does not detect invalid email", () => {
    expect(detectSecrets("not-an-email@").some((d) => d.type === "email")).toBe(
      false,
    );
  });

  test("detects .sa TLD emails", () => {
    expect(detectSecrets("info@business.sa").some((d) => d.type === "email")).toBe(
      true,
    );
  });
});

describe("detectSecrets - saudiPhone", () => {
  const intlCases = [
    { input: "intl +966512345678", expected: "+966512345678", type: "saudiPhonePlus" },
    { input: "intl +966 512345678", expected: "+966 512345678", type: "saudiPhonePlus" },
    { input: "intl 966512345678", expected: "966512345678", type: "saudiPhone9665" },
    { input: "intl 966 512345678", expected: "966 512345678", type: "saudiPhone966" },
    { input: "call +966551234567 please", expected: "+966551234567", type: "saudiPhonePlus" },
  ];

  for (const { input, expected, type } of intlCases) {
    test(`detects ${expected} in "${input}"`, () => {
      const phone = detectSecrets(input).find((d) => d.type === type);
      expect(phone?.text).toBe(expected);
    });
  }

  test("masks partial international number while typing (9 digits)", () => {
    const partial = "+96651234567";
    const phone = findPhone(`my ${partial}`);
    expect(phone?.text).toBe(partial);
  });

  test("masks +966 prefix as soon as typed", () => {
    expect(findPhone("country +966")?.text).toBe("+966");
  });

  test("detects 05 prefixes without context text", () => {
    expect(findPhone("mobile 0512345678")?.text).toBe("0512345678");
    expect(findPhone("call 0598765432")?.text).toBe("0598765432");
    expect(findPhone("052 1234 5678")?.text).toBe("052 1234 5678");
  });

  test("still detects 05 after phone number context", () => {
    expect(findPhone("phone number 0512345678")?.text).toBe("0512345678");
    expect(findPhone("Phone Number is 05 1234 5678")?.text).toBe("05 1234 5678");
    expect(findPhone("my number: 0512345678")?.text).toBe("0512345678");
  });

  test("detects 05 after phone number even with text in between", () => {
    const input =
      "see this phone number pls,sk-12345678901234567890123456789012 ,0512345678";
    const phone = findPhone(input);
    expect(phone?.text).toBe("0512345678");
  });

  test("masks partial local prefix while typing", () => {
    expect(findPhone("051")?.text).toBe("051");
    expect(findPhone("0521234")?.text).toBe("0521234");
  });

  const invalidCases = [
    "0612345678",
    "1234567890",
    "0501234567",
    "order id 966512345678901234",
  ];

  for (const input of invalidCases) {
    test(`ignores invalid or out-of-context phone: ${input}`, () => {
      expect(findPhone(input)).toBeUndefined();
    });
  }
});

describe("detectSecrets - saudiNationalId", () => {
  test("detects national id starting with 1", () => {
    expect(
      detectSecrets("id 1023456789").some((d) => d.type === "saudiNationalId"),
    ).toBe(true);
  });

  test("masks partial id while typing", () => {
    const partial = "1023456";
    const id = detectSecrets(`national id ${partial}`).find(
      (d) => d.type === "saudiNationalId",
    );
    expect(id?.text).toBe(partial);
  });

  test("ignores single digit 1", () => {
    expect(detectSecrets("item 1").some((d) => d.type === "saudiNationalId")).toBe(
      false,
    );
  });
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

  test("detects pk publishable key", () => {
    const key = "pk_live_12345678901234567890123456789012";
    expect(detectSecrets(`stripe ${key}`).some((d) => d.type === "apiKey")).toBe(
      true,
    );
  });

  test("detects api key wrapped in backticks", () => {
    const key = "sk-12345678901234567890123456789012";
    const input = `use \`${key}\` please`;
    expect(detectSecrets(input).some((d) => d.type === "apiKey")).toBe(true);
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

  test("detects dashed credit card", () => {
    const card = "4111-1111-1111-1111";
    expect(detectSecrets(`pay ${card}`).some((d) => d.type === "creditCard")).toBe(
      true,
    );
  });

  test("detects continuous credit card digits", () => {
    expect(
      detectSecrets("pay 4111111111111111").some((d) => d.type === "creditCard"),
    ).toBe(true);
  });
});

describe("detectSecrets - password", () => {
  test("masks only the password value after colon", () => {
    const input = 'config password: MyS3cret!';
    const detection = detectSecrets(input).find((d) => d.type === "password");
    expect(detection?.text).toBe("MyS3cret!");
    expect(sanitize(input)).toBe("config password: *********");
  });

  test("detects password with equals separator", () => {
    expect(sanitize("password=Hidden123")).toBe("password=*********");
  });

  test("detects PassWord is value case-insensitively", () => {
    expect(sanitize("PassWord is SecretValue")).toBe("PassWord is ***********");
  });

  test("detects passw with greater-than separator", () => {
    expect(sanitize("passw > admin123")).toBe("passw > ********");
  });

  test("detects password with quoted value", () => {
    expect(sanitize('password="S3cret!"')).toBe('password="*******"');
  });

  test("handles extra spaces around separators", () => {
    expect(sanitize("password   :   Hidden123")).toBe("password   :   *********");
  });
});

describe("detectSecrets - labeledSecret", () => {
  test("masks value after API_KEY", () => {
    expect(sanitize("API_KEY=abc123secret")).toBe("API_KEY=************");
  });

  test("masks value after SECRET KEY with space", () => {
    expect(sanitize("SECRET KEY: mytoken123")).toBe("SECRET KEY: **********");
  });

  test("masks value after USER_ID", () => {
    expect(sanitize("USER_ID is 9988776655")).toBe("USER_ID is **********");
  });

  test("masks value after client_id case-insensitively", () => {
    expect(sanitize("client_id=abc-def-ghi")).toBe("client_id=***********");
  });

  test("masks value after KEY in different formats", () => {
    expect(sanitize("KEY=sk-123")).toBe("KEY=******");
    expect(sanitize("key = abcdef")).toBe("key = ******");
    expect(sanitize("key: token123")).toBe("key: ********");
    expect(sanitize("KEY : token123")).toBe("KEY : ********");
  });

  test("masks 10 digits after ID label in different formats", () => {
    expect(sanitize("ID=1023456789")).toBe("ID=**********");
    expect(sanitize("id = 1023456789")).toBe("id = **********");
    expect(sanitize("id:1023456789")).toBe("id:**********");
    expect(sanitize("id : 1023456789")).toBe("id : **********");
    expect(sanitize("ID : 1023456789")).toBe("ID : **********");
    expect(sanitize("ID: 1023456789")).toBe("ID: **********");
    expect(sanitize("id: 1023456789")).toBe("id: **********");
  });

  test("does not treat plain 'order id' as a labeled secret", () => {
    expect(
      detectSecrets("order id 966512345678901234").some(
        (d) => d.type === "labeledSecret",
      ),
    ).toBe(false);
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
    const detections = findPhones("+966512345678");
    expect(detections).toHaveLength(1);
  });
});

describe("detectSecrets - metadata", () => {
  test("records start and end offsets", () => {
    const input = "hello test@gmail.com world";
    const email = detectSecrets(input).find((d) => d.type === "email");

    expect(email?.start).toBe(6);
    expect(email?.end).toBe(20);
    expect(input.slice(email!.start, email!.end)).toBe("test@gmail.com");
  });

  test("assigns confidence scores", () => {
    const detections = detectSecrets(
      "email test@gmail.com key sk-12345678901234567890123456789012",
    );

    expect(detections.find((d) => d.type === "email")?.confidence).toBe(0.95);
    expect(detections.find((d) => d.type === "apiKey")?.confidence).toBe(0.9);
  });

  test("skips very short matches", () => {
    expect(detectSecrets("sk-abc").some((d) => d.type === "apiKey")).toBe(false);
  });

  test("detects multiple secrets in one message", () => {
    const input =
      "email test@gmail.com mobile 0512345678 key sk-12345678901234567890123456789012";
    const types = detectSecrets(input).map((d) => d.type);

    expect(types).toContain("email");
    expect(types.some(isPhoneDetection)).toBe(true);
    expect(types).toContain("apiKey");
    expect(types.length).toBeGreaterThanOrEqual(3);
  });
});

describe("sanitize - masking behavior", () => {
  test("masks email with short placeholder", () => {
    expect(sanitize("email test@gmail.com")).toBe("email ****");
  });

  test("masks api key with short placeholder", () => {
    const key = "sk-12345678901234567890123456789012";
    expect(sanitize(`key ${key}`)).toBe("key ****");
  });

  test("masks saudi phone with length-preserving asterisks", () => {
    expect(sanitize("phone number 0512345678")).toBe("phone number **********");
    expect(sanitize("number is 05 1234 5678")).toBe("number is ************");
    expect(sanitize("phone +966512345678")).toBe("phone *************");
  });

  test("masks credit card with length-preserving asterisks", () => {
    const card = "4111 1111 1111 1111";
    expect(sanitize(`card ${card}`)).toBe(`card ${"*".repeat(card.length)}`);
  });

  test("masks multiple secret types in one message", () => {
    const input =
      "email test@gmail.com mobile 0512345678 key sk-12345678901234567890123456789012";
    const output = sanitize(input);

    expect(output).toContain("****");
    expect(output).toContain("**********");
    expect(output).not.toContain("test@gmail.com");
    expect(output).not.toContain("0512345678");
    expect(output).not.toContain("sk-12345678901234567890123456789012");
  });

  test("returns original text when no secrets found", () => {
    const input = "hello world, no secrets here";
    expect(sanitize(input)).toBe(input);
  });

  test("remove strategy strips detections", () => {
    expect(sanitize("email test@gmail.com", "remove")).toBe("email ");
  });

  test("hash strategy replaces with hex hash prefix", () => {
    const output = sanitize("email test@gmail.com", "hash");
    expect(output.startsWith("email ")).toBe(true);
    expect(output).not.toContain("test@gmail.com");
    expect(output.split(" ")[1]?.length).toBe(8);
  });

  test("sanitizes real-world chatgpt-style message", () => {
    const input =
      "see this phone number pls,sk-12345678901234567890123456789012 ,0512345678,0563434567";
    const output = sanitize(input);

    expect(output).toContain("see this phone number pls");
    expect(output).not.toContain("sk-12345678901234567890123456789012");
    expect(output).not.toContain("0512345678");
    expect(output).toContain("****");
    expect(output).toContain("**********");
  });

  test("sanitizes multiple saudi numbers in one line", () => {
    const output = sanitize("phone number 0512345678 or number 0598765432");

    expect(output).not.toContain("0512345678");
    expect(output).not.toContain("0598765432");
    expect(output.match(/\*{10}/g)?.length).toBe(2);
  });

  test("masks national id starting with 1", () => {
    expect(sanitize("national id 1023456789")).toBe("national id **********");
  });

  test("masks partial phone while user is still typing", () => {
    expect(sanitize("phone number 051234567")).toBe("phone number *********");
    expect(sanitize("intl +96651234567")).toBe("intl ************");
  });

  test("preserves surrounding punctuation after redaction", () => {
    expect(sanitize("(test@gmail.com)")).toBe("(****)");
    expect(sanitize("email: test@gmail.com.")).toBe("email: ****.");
  });

  test("leaves generic example.com unmasked", () => {
    expect(sanitize("email test@example.com")).toBe("email test@example.com");
  });
});

describe("sanitizePayload - claude api bodies", () => {
  test("redacts message_content only", () => {
    const body = JSON.stringify({
      message_content: "email test@gmail.com phone number 0512345678",
      context_token: "abc-session-token",
      conversation_id: "uuid-1234-5678",
    });

    const result = JSON.parse(sanitizePayload(body));

    expect(result.message_content).toBe("email **** phone number **********");
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
      message_content: "test@gmail.com",
    });

    expect(() => sanitizePayload(body)).toThrow(EmptyMessageError);
  });

  test("allows mixed message after redaction", () => {
    const body = JSON.stringify({
      message_content: "my email is test@gmail.com thanks",
    });

    const result = JSON.parse(sanitizePayload(body));
    expect(result.message_content).toBe("my email is **** thanks");
  });

  test("sanitizes plain text bodies", () => {
    expect(sanitizePayload("phone number 0512345678")).toBe(
      "phone number **********",
    );
  });
});

describe("sanitizePayload - chatgpt api bodies", () => {
  test("redacts content.parts user text", () => {
    const body = JSON.stringify({
      action: "next",
      messages: [
        {
          id: "08e83fff-47f3-48d3-9d9d-cd88ba4f6a2c",
          author: { role: "user" },
          content: {
            content_type: "text",
            parts: [
              "see this phone number pls,sk-12345678901234567890123456789012 ,0512345678",
            ],
          },
        },
      ],
    });

    const result = JSON.parse(sanitizePayload(body));
    const part = result.messages[0].content.parts[0];

    expect(part).toContain("see this phone number pls");
    expect(part).toContain("****");
    expect(part).toContain("**********");
    expect(part).not.toContain("sk-12345678901234567890123456789012");
    expect(part).not.toContain("0512345678");
    expect(result.messages[0].id).toBe("08e83fff-47f3-48d3-9d9d-cd88ba4f6a2c");
    expect(result.messages[0].author.role).toBe("user");
    expect(result.messages[0].content.content_type).toBe("text");
  });

  test("preserves metadata while redacting parts", () => {
    const body = JSON.stringify({
      conversation_id: "conv-123",
      model: "gpt-4o",
      messages: [
        {
          content: {
            content_type: "text",
            parts: ["email test@gmail.com thanks"],
          },
        },
      ],
    });

    const result = JSON.parse(sanitizePayload(body));

    expect(result.conversation_id).toBe("conv-123");
    expect(result.model).toBe("gpt-4o");
    expect(result.messages[0].content.parts[0]).toBe("email **** thanks");
  });

  test("redacts every part in a multi-part array", () => {
    const body = JSON.stringify({
      messages: [
        {
          content: {
            content_type: "text",
            parts: [
              "first test@gmail.com",
              "phone number 0512345678",
            ],
          },
        },
      ],
    });

    const result = JSON.parse(sanitizePayload(body));
    const parts = result.messages[0].content.parts;

    expect(parts[0]).toBe("first ****");
    expect(parts[1]).toBe("phone number **********");
  });

  test("matches exact leaking payload shape from chatgpt", () => {
    const body = JSON.stringify({
      action: "next",
      messages: [
        {
          id: "08e83fff-47f3-48d3-9d9d-cd88ba4f6a2c",
          author: { role: "user" },
          content: {
            content_type: "text",
            parts: [
              "see this phone number pls,sk-12345678901234567890123456789012 ,0512345678,0563434567",
            ],
          },
        },
      ],
    });

    const serialized = sanitizePayload(body);
    expect(serialized).not.toContain("sk-12345678901234567890123456789012");
    expect(serialized).not.toContain("0512345678");
    expect(serialized).toContain("see this phone number pls");
  });
});

describe("shouldSanitizeRequest - chatgpt", () => {
  test("matches backend-api conversation routes", () => {
    expect(
      shouldSanitizeRequest("https://chatgpt.com/backend-api/conversation"),
    ).toBe(true);
    expect(
      shouldSanitizeRequest("https://chatgpt.com/backend-anon/conversation"),
    ).toBe(true);
  });

  test("matches chat payload even on unknown chatgpt path", () => {
    const body = JSON.stringify({
      messages: [{ content: { parts: ["hello"] } }],
    });

    expect(shouldSanitizeRequest("https://chatgpt.com/new-endpoint/v1", body)).toBe(
      true,
    );
  });

  test("does not match chatgpt telemetry endpoints", () => {
    expect(
      shouldSanitizeRequest("https://chatgpt.com/ces/v1/t", "{}"),
    ).toBe(false);
    expect(
      shouldSanitizeRequest("https://chatgpt.com/statsc/flush", "{}"),
    ).toBe(false);
  });

  test("matches chat.openai.com backend routes", () => {
    expect(
      shouldSanitizeRequest("https://chat.openai.com/backend-api/conversation"),
    ).toBe(true);
  });
});

describe("shouldSanitizeRequest - claude", () => {
  test("matches claude chat api routes", () => {
    expect(
      shouldSanitizeRequest("https://claude.ai/api/organizations/org/chat"),
    ).toBe(true);
    expect(
      shouldSanitizeRequest("https://claude.ai/api/messages"),
    ).toBe(true);
  });

  test("does not match claude static assets", () => {
    expect(
      shouldSanitizeRequest("https://claude.ai/_next/static/chunk.js"),
    ).toBe(false);
  });
});

describe("looksLikeChatPayload", () => {
  test("detects chat-shaped json bodies", () => {
    expect(looksLikeChatPayload('{"messages":[{"content":{"parts":["hi"]}}]}')).toBe(
      true,
    );
    expect(looksLikeChatPayload('{"message_content":"hello"}')).toBe(true);
    expect(looksLikeChatPayload('{"prompt":"hello"}')).toBe(true);
  });

  test("ignores non-chat json bodies", () => {
    expect(looksLikeChatPayload('{"event":"page_view"}')).toBe(false);
    expect(looksLikeChatPayload('{"status":"ok"}')).toBe(false);
  });
});

describe("isAiChatHost", () => {
  test("recognizes supported ai chat hosts", () => {
    expect(isAiChatHost("chatgpt.com")).toBe(true);
    expect(isAiChatHost("chat.openai.com")).toBe(true);
    expect(isAiChatHost("claude.ai")).toBe(true);
  });

  test("rejects unrelated hosts", () => {
    expect(isAiChatHost("google.com")).toBe(false);
    expect(isAiChatHost("example.com")).toBe(false);
  });
});

describe("body conversion helpers", () => {
  test("bodyToText reads string and array buffer bodies", () => {
    const text = '{"message_content":"hello"}';
    expect(bodyToText(text)).toBe(text);
    expect(bodyToText(new TextEncoder().encode(text))).toBe(text);
    expect(bodyToText(new TextEncoder().encode(text).buffer)).toBe(text);
  });

  test("textToBody preserves original body type", () => {
    const text = '{"message_content":"****"}';
    expect(textToBody(text, "original")).toBe(text);
    expect(textToBody(text, new TextEncoder().encode("x").buffer)).toBeInstanceOf(
      ArrayBuffer,
    );
    expect(textToBody(text, new TextEncoder().encode("x"))).toBeInstanceOf(
      Uint8Array,
    );
  });

  test("bodyToText returns null for unsupported body types", () => {
    expect(bodyToText(new Blob(["x"]))).toBe(null);
    expect(bodyToText(null)).toBe(null);
  });
});

describe("sanitizePayload - edge cases", () => {
  test("does not mutate skipped metadata keys", () => {
    const body = JSON.stringify({
      message_content: "hello test@gmail.com",
      trace_id: "trace-abc-123",
      message_uuid: "uuid-should-stay",
      parent_message_uuid: "parent-uuid-should-stay",
    });

    const result = JSON.parse(sanitizePayload(body));

    expect(result.message_content).toBe("hello ****");
    expect(result.trace_id).toBe("trace-abc-123");
    expect(result.message_uuid).toBe("uuid-should-stay");
    expect(result.parent_message_uuid).toBe("parent-uuid-should-stay");
  });

  test("sanitizes prompt field for generic api payloads", () => {
    const body = JSON.stringify({
      prompt: "phone number 0512345678",
      model: "gpt-4o",
    });

    const result = JSON.parse(sanitizePayload(body));
    expect(result.prompt).toBe("phone number **********");
    expect(result.model).toBe("gpt-4o");
  });

  test("falls back to plain sanitize for invalid json", () => {
    expect(sanitizePayload("phone number 0512345678")).toBe(
      "phone number **********",
    );
    expect(sanitizePayload("not-json but test@gmail.com")).toBe(
      "not-json but ****",
    );
  });

  test("allows message with punctuation after redaction", () => {
    const body = JSON.stringify({
      message_content: "please redact test@gmail.com!",
    });

    const result = JSON.parse(sanitizePayload(body));
    expect(result.message_content).toBe("please redact ****!");
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
      message_content: "test@gmail.com",
    });

    expect(result).toEqual({
      context_token: "secret-looking-but-kept",
      message_content: "****",
    });
  });

  test("does not sanitize content_type or role fields", () => {
    const result = sanitizeDeep({
      content: {
        content_type: "text",
        role: "user",
        parts: ["test@gmail.com"],
      },
    });

    expect(result).toEqual({
      content: {
        content_type: "text",
        role: "user",
        parts: ["****"],
      },
    });
  });

  test("leaves numeric and boolean values unchanged", () => {
    const result = sanitizeDeep({
      message_content: "hello",
      max_tokens: 1024,
      stream: true,
    });

    expect(result).toEqual({
      message_content: "hello",
      max_tokens: 1024,
      stream: true,
    });
  });
});
