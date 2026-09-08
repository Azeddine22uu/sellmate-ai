import { Router, type IRouter } from "express";
import {
  generateAssistantReply,
  historyFrom,
  productsFrom,
  text,
  type AssistantSettings,
} from "../lib/assistant-engine";

const router: IRouter = Router();

router.post("/assistant/chat", async (req, res) => {
  const body = req.body as {
    question?: unknown;
    products?: unknown;
    settings?: unknown;
    history?: unknown;
  };
  const question = text(body.question, 1200);
  const products = productsFrom(body.products);
  const settings = body.settings && typeof body.settings === "object"
    ? body.settings as AssistantSettings
    : {};

  if (!question) {
    res.status(400).json({ message: "A customer question is required." });
    return;
  }

  try {
    const reply = await generateAssistantReply({
      question,
      products,
      settings,
      history: historyFrom(body.history),
    });
    res.json({ reply });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AI_REQUEST_FAILED";
    if (code === "AI_NOT_CONFIGURED") {
      res.status(503).json({ message: "The AI service is not configured yet." });
      return;
    }
    req.log.error({ code }, "OpenAI assistant request failed");
    res.status(502).json({ message: "The AI service could not answer right now." });
  }
});

export default router;