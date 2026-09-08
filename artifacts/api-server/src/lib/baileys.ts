import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

export type BaileysStatus = "connecting" | "qr" | "connected" | "disconnected" | "error";

export type BaileysSessionSnapshot = {
  status: BaileysStatus;
  qrDataUrl?: string;
  phoneNumber?: string;
  error?: string;
};

type BaileysSession = BaileysSessionSnapshot & {
  socket?: WASocket;
  stopping?: boolean;
};

type SessionHooks = {
  onStatus: (snapshot: BaileysSessionSnapshot) => void | Promise<void>;
  onMessage: (message: WAMessage) => void | Promise<void>;
};

const sessions = new Map<string, BaileysSession>();
const hooks = new Map<string, SessionHooks>();
const authRoot = path.resolve(
  process.env.WHATSAPP_AUTH_DIR || path.join(process.cwd(), ".data", "whatsapp"),
);
const silentLogger = pino({ level: "silent" });

function safeStoreId(storeId: string) {
  return storeId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function statusCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const output = (error as { output?: { statusCode?: unknown } }).output;
  return typeof output?.statusCode === "number" ? output.statusCode : undefined;
}

async function publish(storeId: string, snapshot: BaileysSessionSnapshot) {
  const current = sessions.get(storeId);
  sessions.set(storeId, {
    socket: current?.socket,
    stopping: current?.stopping,
    ...snapshot,
  });
  await hooks.get(storeId)?.onStatus(snapshot);
}

export function getBaileysStatus(storeId: string): BaileysSessionSnapshot {
  const session = sessions.get(storeId);
  if (!session) return { status: "disconnected" };
  return {
    status: session.status,
    qrDataUrl: session.qrDataUrl,
    phoneNumber: session.phoneNumber,
    error: session.error,
  };
}

export async function startBaileysSession(storeId: string, sessionHooks: SessionHooks) {
  hooks.set(storeId, sessionHooks);
  const current = sessions.get(storeId);
  if (current?.status === "connecting" || current?.status === "qr" || current?.status === "connected") {
    return current;
  }

  const authDir = path.join(authRoot, safeStoreId(storeId));
  await mkdir(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const session: BaileysSession = { status: "connecting" };
  sessions.set(storeId, session);

  const socket = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
    logger: silentLogger,
    markOnlineOnConnect: false,
    printQRInTerminal: false,
    syncFullHistory: false,
  });
  session.socket = socket;

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      await publish(storeId, { status: "qr", qrDataUrl });
    }

    if (connection === "connecting") {
      await publish(storeId, { status: "connecting" });
    }

    if (connection === "open") {
      const phoneNumber = socket.user?.id?.split(":")[0];
      await publish(storeId, { status: "connected", qrDataUrl: undefined, phoneNumber });
    }

    if (connection === "close") {
      const code = statusCode(lastDisconnect?.error);
      const status: BaileysStatus = code === DisconnectReason.loggedOut || code === DisconnectReason.forbidden
        ? "error"
        : "disconnected";
      await publish(storeId, {
        status,
        error: status === "error" ? "WhatsApp logged out. Scan a new QR code to reconnect." : undefined,
      });
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    await Promise.all(messages.map(message => sessionHooks.onMessage(message)));
  });

  return session;
}

export async function sendBaileysText(storeId: string, to: string, text: string) {
  const socket = sessions.get(storeId)?.socket;
  if (!socket || sessions.get(storeId)?.status !== "connected") {
    throw new Error("WHATSAPP_NOT_CONNECTED");
  }
  await socket.sendMessage(to, { text });
}

export async function stopBaileysSession(storeId: string, clearAuth = true) {
  const session = sessions.get(storeId);
  if (session) {
    session.stopping = true;
    await session.socket?.end(undefined);
  }
  sessions.delete(storeId);
  hooks.delete(storeId);
  if (clearAuth) {
    await rm(path.join(authRoot, safeStoreId(storeId)), { recursive: true, force: true });
  }
}