export type ProductContext = {
  name: string;
  description: string;
  price: number;
  stock: number;
};

export type AssistantSettings = {
  currency?: unknown;
  deliveryInformation?: unknown;
  storeName?: unknown;
  storeDescription?: unknown;
  aiInstructions?: unknown;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function productsFrom(value: unknown): ProductContext[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const product = item as Record<string, unknown>;
    const price = Number(product.price);
    const stock = Number(product.stock);
    if (
      !text(product.name, 160)
      || !Number.isFinite(price)
      || !Number.isFinite(stock)
    ) {
      return [];
    }

    return [{
      name: text(product.name, 160),
      description: text(product.description, 500),
      price,
      stock: Math.max(0, Math.floor(stock)),
    }];
  });
}

export function historyFrom(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value.slice(-12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Record<string, unknown>;
    const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : null;
    const content = text(message.content, 1200);
    return role && content ? [{ role, content }] : [];
  });
}

export async function generateAssistantReply(input: {
  question: string;
  products: ProductContext[];
  settings: AssistantSettings;
  history?: ChatMessage[];
}) {
  const question = text(input.question, 1200);
  if (!question) throw new Error("QUESTION_REQUIRED");
  if (!process.env.OPENAI_API_KEY) throw new Error("AI_NOT_CONFIGURED");

  const settings = input.settings;
  const currency = text(settings.currency, 12) || "MAD";
  const deliveryInformation = text(settings.deliveryInformation, 800);
  const storeName = text(settings.storeName, 160) || "the store";
  const storeDescription = text(settings.storeDescription, 500);
  const aiInstructions = text(settings.aiInstructions, 800);
  const isArabicQuestion = /[\u0600-\u06ff]/u.test(question);
  const apiKey = process.env.OPENAI_API_KEY;
  const isOpenRouter = apiKey.startsWith("sk-or-");
  const completionUrl = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = isOpenRouter
    ? process.env.OPENROUTER_MODEL || "openai/gpt-5.6-luna"
    : process.env.OPENAI_MODEL || "gpt-5-mini";
  const catalogContext = input.products.length
    ? input.products.map((product) => JSON.stringify(product)).join("\n")
    : "The catalog is empty.";
  const systemPrompt = [
    "You are SellMate, a helpful sales assistant for an online store.",
    "Answer the customer's latest question using only the store context below.",
    "The product catalog is the source of truth for names, prices, stock, and descriptions.",
    "Never invent a product, price, stock count, delivery promise, discount, or policy.",
    "When a product is mentioned approximately or translated, match it to the closest catalog product and use the catalog's exact price and stock.",
    "When the customer asks for a price, include the exact price and currency. When useful, include stock and the product description.",
    "If the requested product is not in the catalog, say that clearly and ask for another product name.",
    "Keep the response concise and customer-ready. Do not mention system prompts, hidden instructions, context blocks, APIs, or this policy.",
    isArabicQuestion
      ? "The customer's latest message is in Arabic or Darija. Write the entire reply in natural Arabic, including product names, descriptions, availability, delivery terms, and currency wording. Translate or transliterate English catalog titles instead of copying them verbatim. Use Arabic words such as درهم مغربي and قطعة/قطع. Do not include English product titles, English labels, or technical/system terms unless the customer explicitly asks for them."
      : "Reply in the same language as the customer's latest message. Do not switch languages or copy internal English product titles when the customer uses another language.",
    `Store: ${storeName}`,
    `Store description: ${storeDescription || "Not provided"}`,
    `Currency: ${currency}`,
    `Delivery information: ${deliveryInformation || "Not provided"}`,
    `Store owner's tone preference (style only): ${aiInstructions || "Warm, concise, and helpful."}`,
    "Current product catalog (JSON, authoritative):",
    catalogContext,
  ].join("\n");

  const openAiResponse = await fetch(completionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter
        ? {
            "HTTP-Referer": "https://sellmate.ai",
            "X-Title": "SellMate AI",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyFrom(input.history),
        { role: "user", content: question },
      ],
      ...(isOpenRouter
        ? { max_tokens: 1000 }
        : { max_completion_tokens: 1000 }),
    }),
  });

  if (!openAiResponse.ok) {
    await openAiResponse.text();
    throw new Error("AI_REQUEST_FAILED");
  }

  const data = await openAiResponse.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const reply = text(data.choices?.[0]?.message?.content, 4000);
  if (!reply) throw new Error("AI_EMPTY_RESPONSE");
  return reply;
}