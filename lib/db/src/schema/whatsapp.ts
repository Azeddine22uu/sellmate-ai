import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappConnectionsTable = pgTable("whatsapp_connections", {
  storeId: text("store_id").primaryKey(),
  connectionId: text("connection_id").notNull().unique(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  phoneNumber: text("phone_number"),
  webhookToken: text("webhook_token").notNull(),
  status: text("status").notNull().default("pending"),
  context: jsonb("context").notNull(),
  conversations: jsonb("conversations").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnectionsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;
export type WhatsappConnection = typeof whatsappConnectionsTable.$inferSelect;