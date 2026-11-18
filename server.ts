import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-3.1-flash-lite";
const PROMPT_TEXT =
  "用台灣繁體中文列出圖中可見的水果或食材，每種一行。看不清楚請寫『無法確認』；整張沒有食材就回答『未辨識到食材』。";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

function parseIngredientLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•·]+\s*/, "")
        .replace(/^\d+[.)、]\s*/, "")
        .trim()
    )
    .filter((line) => line.length > 0);
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : typeof err === "string" ? err : "未知錯誤";
  const statusFromErr =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("PERMISSION_DENIED") ||
    statusFromErr === 403
  ) {
    return {
      status: 403,
      message:
        "Gemini API 金鑰無效或權限不足，請在 AI Studio 的「Settings > Secrets」確認 GEMINI_API_KEY。",
    };
  }

  if (rawMessage.includes("RESOURCE_EXHAUSTED") || statusFromErr === 429) {
    return {
      status: 429,
      message: "目前 API 呼叫次數已達上限，請稍候片刻再點擊重試。",
    };
  }

  if (rawMessage.includes("NOT_FOUND") || statusFromErr === 404) {
    return {
      status: 404,
      message: `找不到指定的模型（${MODEL_NAME}）或端點無法存取。`,
    };
  }

  if (statusFromErr === 400 || rawMessage.includes("INVALID_ARGUMENT")) {
    return {
      status: 400,
      message: "送出的圖片格式或內容無法被模型解析，請更換清晰的 JPG／PNG 照片。",
    };
  }

  return {
    status: statusFromErr && statusFromErr >= 400 ? statusFromErr : 502,
    message: `呼叫 Gemini 辨識服務失敗：${rawMessage}`,
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "30mb" }));

  // Handle malformed JSON or payload-too-large errors cleanly
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      (err as { type?: string }).type === "entity.too.large"
    ) {
      res.status(413).json({
        error: "圖片檔案過大，請選擇 20 MB 以下的 JPG 或 PNG 照片。",
      });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "請求資料格式錯誤。" });
      return;
    }
    next(err);
  });

  app.post("/api/recognize", async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      res.status(500).json({
        error:
          "伺服器尚未設定 GEMINI_API_KEY，請於 AI Studio 的 Secrets 面板設定金鑰後再試。",
      });
      return;
    }

    const body = req.body as {
      imageBase64?: unknown;
      mimeType?: unknown;
    };

    if (typeof body?.mimeType !== "string" || !ALLOWED_MIME_TYPES.has(body.mimeType)) {
      res.status(400).json({
        error: "僅支援 JPG（image/jpeg）或 PNG（image/png）圖片格式。",
      });
      return;
    }

    if (typeof body?.imageBase64 !== "string" || body.imageBase64.trim().length === 0) {
      res.status(400).json({
        error: "缺少圖片資料，請重新選擇照片。",
      });
      return;
    }

    const cleanedBase64 = body.imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
    const byteLength = Buffer.from(cleanedBase64, "base64").byteLength;

    if (byteLength === 0 || byteLength > MAX_IMAGE_BYTES) {
      res.status(400).json({
        error: "圖片資料無效或超過 20 MB 大小上限。",
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: body.mimeType,
                data: cleanedBase64,
              },
            },
            {
              text: PROMPT_TEXT,
            },
          ],
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({
          error: "模型未回傳辨識文字結果，請點擊重試。",
        });
        return;
      }

      const items = parseIngredientLines(rawText);
      if (items.length === 0) {
        res.status(502).json({
          error: "模型回覆內容無法解析為清單項目，請點擊重試。",
        });
        return;
      }

      res.json({
        model: MODEL_NAME,
        rawText,
        items,
      });
    } catch (error: unknown) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Not Found");
      }
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
