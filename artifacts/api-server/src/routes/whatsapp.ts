import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import type { WAMessage } from "@whiskeysockets/baileys";
import { db, whatsappConnectionsTable } from "@workspace/db";
import {
  getBaileysStatus,
  sendBaileysText,
  startBaileysSession,
  stopBaileysSession,
  type BaileysSessionSnapshot,
} from "../lib/baileys";
import { logger } from "../lib/logger";
import {
  generateAssistantReply,
  historyFrom,
  productsFrom,
  text,
  type AssistantSettings,
  type ChatMessage,
} from "../lib/assistant-engine";

type StoreContext = {
  products: unknown[];
  settings: AssistantSettings;
};

type Provider = "cloud-api" | "baileys" | "webhook";

const router: IRouter = Router();

function providerFrom(value: unknown): Provider {
  return value === "cloud-api" || value === "webhook" ? value : "baileys";
}

function storeContextFrom(value: unknown): StoreContext {
  if (!value || typeof value !== "object") return { products: [], settings: {} };
  const context = value as Record<string, unknown>;
  return {
    products: Array.isArray(context.products) ? context.products.slice(0, 100) : [],
    settings: context.settings && typeof context.settings === "object"
      ? context.settings as AssistantSettings
      : {},
  };
}

function publicConnection(connection: typeof whatsappConnectionsTable.$inferSelect) {
  return {
    storeId: connection.storeId,
    connectionId: connection.connectionId,
    provider: connection.provider,
    displayName: connection.displayName,
    phoneNumber: connection.phoneNumber,
    status: connection.status,
    webhookToken: connection.webhookToken,
    webhookPath: `/api/whatsapp/webhook/${connection.connectionId}`,
    updatedAt: connection.updatedAt,
  };
}

async function getConnection(storeId: string) {
  const result = await db
    .select()
    .from(whatsappConnectionsTable)
    .where(eq(whatsappConnectionsTable.storeId, storeId))
    .limit(1);
  return result[0];
}

async function updateBaileysDatabaseStatus(storeId: string, snapshot: BaileysSessionSnapshot) {
  await db
    .update(whatsappConnectionsTable)
    .set({
      status: snapshot.status,
      phoneNumber: snapshot.phoneNumber || undefined,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConnectionsTable.storeId, storeId));
}

function baileysMessageFrom(message: WAMessage) {
  if (message.key.fromMe) return null;
  const sender = message.key.remoteJid;
  if (!sender || sender === "status@broadcast" || sender.endsWith("@g.us")) return null;
  const content = message.message;
  const messageText = content?.conversation || content?.extendedTextMessage?.text;
  const textValue = text(messageText, 1200);
  return textValue ? { sender, messageId: text(message.key.id, 160), text: textValue } : null;
}

async function handleBaileysMessage(storeId: string, message: WAMessage) {
  const incoming = baileysMessageFrom(message);
  if (!incoming) return;
  const connection = await getConnection(storeId);
  if (!connection || connection.provider !== "baileys") return;

  const context = storeContextFrom(connection.context);
  const conversations = connection.conversations && typeof connection.conversations === "object"
    ? connection.conversations as Record<string, unknown>
    : {};
  const history = conversationHistory(conversations, incoming.sender);
  const reply = await generateAssistantReply({
    question: incoming.text,
    products: productsFrom(context.products),
    settings: context.settings,
    history,
  });
  await sendBaileysText(storeId, incoming.sender, reply);
  conversations[incoming.sender] = [
    ...history.slice(-10),
    { role: "user", content: incoming.text },
    { role: "assistant", content: reply },
  ];
  await db.update(whatsappConnectionsTable)
    .set({ conversations, updatedAt: new Date() })
    .where(and(eq(whatsappConnectionsTable.connectionId, connection.connectionId), eq(whatsappConnectionsTable.storeId, storeId)));
}

async function startStoreBaileys(storeId: string) {
  await startBaileysSession(storeId, {
    onStatus: snapshot => updateBaileysDatabaseStatus(storeId, snapshot),
    onMessage: message => handleBaileysMessage(storeId, message).catch(error => {
      const code = error instanceof Error ? error.message : "WHATSAPP_MESSAGE_FAILED";
      logger.error({ code, storeId }, "WhatsApp message handling failed");
    }),
  });
}

router.post("/whatsapp/connect", async (req, res) => {
  const body = req.body as {
    storeId?: unknown;
    provider?: unknown;
    displayName?: unknown;
    phoneNumber?: unknown;
    context?: unknown;
  };
  const storeId = text(body.storeId, 120);
  const displayName = text(body.displayName, 160) || "My WhatsApp store";
  if (!storeId) {
    res.status(400).json({ message: "A store ID is required." });
    return;
  }

  const existing = await getConnection(storeId);
  const connectionId = existing?.connectionId || `wa_${randomUUID()}`;
  const webhookToken = existing?.webhookToken || randomBytes(18).toString("hex");
  const provider = providerFrom(body.provider);
  const hasCloudCredentials = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
  const status = provider === "baileys"
    ? "connecting"
    : provider === "cloud-api" && hasCloudCredentials ? "connected" : "pending";
  const values = {
    storeId,
    connectionId,
    provider,
    displayName,
    phoneNumber: text(body.phoneNumber, 40) || null,
    webhookToken,
    status,
    context: storeContextFrom(body.context),
    conversations: existing?.conversations ?? {},
  };

  await db.insert(whatsappConnectionsTable).values(values).onConflictDoUpdate({
    target: whatsappConnectionsTable.storeId,
    set: {
      provider,
      displayName,
      phoneNumber: values.phoneNumber,
      status,
      context: values.context,
      updatedAt: new Date(),
    },
  });
  const saved = await getConnection(storeId);
  if (!saved) {
    res.status(500).json({ message: "WhatsApp connection could not be saved." });
    return;
  }
  if (provider === "baileys") {
    void startStoreBaileys(storeId).catch(async error => {
      const code = error instanceof Error ? error.message : "BAILEYS_START_FAILED";
      req.log.error({ code, storeId }, "Baileys session failed to start");
      await updateBaileysDatabaseStatus(storeId, { status: "error", error: "WhatsApp Web could not start." });
    });
  }
  res.json({ connection: publicConnection(saved) });
});

router.get("/whatsapp/connection/:storeId", async (req, res) => {
  const storeId = text(req.params.storeId, 120);
  const connection = await getConnection(storeId);
  if (!connection) {
    res.status(404).json({ message: "No WhatsApp connection found." });
    return;
  }
  res.json({ connection: publicConnection(connection) });
});

router.get("/whatsapp/baileys/status/:storeId", async (req, res) => {
  const storeId = text(req.params.storeId, 120);
  const connection = await getConnection(storeId);
  if (!connection || connection.provider !== "baileys") {
    res.status(404).json({ message: "No direct WhatsApp Web connection found." });
    return;
  }
  res.json({
    connection: publicConnection(connection),
    session: getBaileysStatus(storeId),
  });
});

router.post("/whatsapp/baileys/start", async (req, res) => {
  const storeId = text((req.body as { storeId?: unknown }).storeId, 120);
  const connection = await getConnection(storeId);
  if (!connection || connection.provider !== "baileys") {
    res.status(404).json({ message: "Create a direct WhatsApp Web connection first." });
    return;
  }
  void startStoreBaileys(storeId).catch(error => {
    const code = error instanceof Error ? error.message : "BAILEYS_START_FAILED";
    req.log.error({ code, storeId }, "Baileys session failed to start");
  });
  res.status(202).json({ started: true, session: getBaileysStatus(storeId) });
});

router.post("/whatsapp/baileys/stop", async (req, res) => {
  const storeId = text((req.body as { storeId?: unknown }).storeId, 120);
  const connection = await getConnection(storeId);
  if (!connection || connection.provider !== "baileys") {
    res.status(404).json({ message: "No direct WhatsApp Web connection found." });
    return;
  }
  await stopBaileysSession(storeId);
  await db.update(whatsappConnectionsTable)
    .set({ status: "disconnected", phoneNumber: null, updatedAt: new Date() })
    .where(eq(whatsappConnectionsTable.storeId, storeId));
  res.json({ stopped: true });
});

router.post("/whatsapp/sync", async (req, res) => {
  const body = req.body as { storeId?: unknown; context?: unknown };
  const storeId = text(body.storeId, 120);
  const connection = await getConnection(storeId);
  if (!connection) {
    res.status(404).json({ message: "Connect WhatsApp before syncing store context." });
    return;
  }
  await db
    .update(whatsappConnectionsTable)
    .set({ context: storeContextFrom(body.context), updatedAt: new Date() })
    .where(eq(whatsappConnectionsTable.storeId, storeId));
  res.json({ synced: true, updatedAt: new Date().toISOString() });
});

router.post("/whatsapp/disconnect", async (req, res) => {
  const storeId = text((req.body as { storeId?: unknown }).storeId, 120);
  if (!storeId) {
    res.status(400).json({ message: "A store ID is required." });
    return;
  }
  const connection = await getConnection(storeId);
  if (connection?.provider === "baileys") await stopBaileysSession(storeId);
  await db.delete(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.storeId, storeId));
  res.json({ disconnected: true });
});

router.get("/whatsapp/webhook/:connectionId", async (req, res) => {
  const connectionId = text(req.params.connectionId, 120);
  const connection = (await db
    .select()
    .from(whatsappConnectionsTable)
    .where(eq(whatsappConnectionsTable.connectionId, connectionId))
    .limit(1))[0];
  const query = req.query as Record<string, string | undefined>;
  if (
    connection
    && query["hub.mode"] === "subscribe"
    && query["hub.verify_token"] === connection.webhookToken
    && query["hub.challenge"]
  ) {
    res.status(200).send(query["hub.challenge"]);
    return;
  }
  res.sendStatus(403);
});

function incomingMessageFrom(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, any>;
  const change = payload.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  if (message?.from && message?.text?.body) {
    return { sender: text(message.from, 80), messageId: text(message.id, 160), text: text(message.text.body, 1200) };
  }
  const generic = payload.message && typeof payload.message === "object" ? payload.message : payload;
  if (generic.from && (generic.text || generic.body)) {
    return {
      sender: text(generic.from, 80),
      messageId: text(generic.id, 160),
      text: text(generic.text || generic.body, 1200),
    };
  }
  return null;
}

function conversationHistory(conversations: unknown, sender: string): ChatMessage[] {
  if (!conversations || typeof conversations !== "object") return [];
  const value = (conversations as Record<string, unknown>)[sender];
  return historyFrom(value);
}

async function sendCloudReply(to: string, reply: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;
  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: reply },
    }),
  });
  if (!response.ok) {
    await response.text();
    throw new Error("WHATSAPP_SEND_FAILED");
  }
  return true;
}

router.post("/whatsapp/webhook/:connectionId", async (req, res) => {
  const connectionId = text(req.params.connectionId, 120);
  const connection = (await db
    .select()
    .from(whatsappConnectionsTable)
    .where(eq(whatsappConnectionsTable.connectionId, connectionId))
    .limit(1))[0];
  if (!connection) {
    res.sendStatus(404);
    return;
  }

  const incoming = incomingMessageFrom(req.body);
  if (!incoming) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }
  const context = storeContextFrom(connection.context);
  const conversations = connection.conversations && typeof connection.conversations === "object"
    ? connection.conversations as Record<string, unknown>
    : {};
  const history = conversationHistory(conversations, incoming.sender);
  try {
    const reply = await generateAssistantReply({
      question: incoming.text,
      products: productsFrom(context.products),
      settings: context.settings,
      history,
    });
    const delivered = connection.provider === "cloud-api"
      ? await sendCloudReply(incoming.sender, reply)
      : false;
    conversations[incoming.sender] = [
      ...history.slice(-10),
      { role: "user", content: incoming.text },
      { role: "assistant", content: reply },
    ];
    await db.update(whatsappConnectionsTable)
      .set({ conversations, updatedAt: new Date() })
      .where(and(eq(whatsappConnectionsTable.connectionId, connectionId), eq(whatsappConnectionsTable.storeId, connection.storeId)));
    res.status(200).json({ received: true, reply, delivered, deliveryMode: delivered ? "whatsapp-cloud-api" : "demo" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "WHATSAPP_REPLY_FAILED";
    req.log.error({ code, connectionId }, "WhatsApp assistant reply failed");
    res.status(code === "AI_NOT_CONFIGURED" ? 503 : 502).json({
      message: code === "AI_NOT_CONFIGURED"
        ? "The AI service is not configured yet."
        : "The WhatsApp assistant could not answer right now.",
    });
  }
});

export default router;