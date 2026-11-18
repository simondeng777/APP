import React, { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import {
  DEVICE_SPECS,
  DeviceType,
  PhoneFrame,
  SelectedPhoto,
} from "./components/PhoneFrame";

function resolveAllowedMimeType(file: File): "image/jpeg" | "image/png" | null {
  if (file.type === "image/jpeg" || file.type === "image/jpg") {
    return "image/jpeg";
  }
  if (file.type === "image/png") {
    return "image/png";
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  return null;
}

export default function App() {
  const [device, setDevice] = useState<DeviceType>("iphone");
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [fileFormatError, setFileFormatError] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Automatically shrink phone frame when viewport is narrower (or shorter) than the selected device frame
  const recomputeScale = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;

    const spec = DEVICE_SPECS[device];
    const outerWidth = spec.width + 24; // includes 10px hardware ring on each side + safety gap
    const outerHeight = spec.height + 24;

    const availW = el.clientWidth;
    const availH = el.clientHeight;

    const scaleW = availW < outerWidth ? Math.max(0.45, (availW - 16) / outerWidth) : 1;
    const scaleH = availH < outerHeight ? Math.max(0.45, (availH - 12) / outerHeight) : 1;
    const nextScale = Math.min(1, scaleW, scaleH);

    setScale(Number(nextScale.toFixed(4)));
  }, [device]);

  useEffect(() => {
    recomputeScale();
    const el = stageRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      recomputeScale();
    });
    observer.observe(el);
    window.addEventListener("resize", recomputeScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recomputeScale);
    };
  }, [recomputeScale]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleTriggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset input value so re-selecting the same file name still fires onChange
      event.target.value = "";
      if (!file) return;

      const mimeType = resolveAllowedMimeType(file);
      if (!mimeType) {
        setFileFormatError("僅支援 JPG 或 PNG 格式的圖片檔案，請重新選擇。");
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setFileFormatError("圖片檔案大小不可超過 20 MB，請選擇較小的檔案。");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const commaIndex = result.indexOf(",");
        if (!result || commaIndex === -1) {
          setFileFormatError("無法讀取該圖片檔案內容，請重新選擇。");
          return;
        }

        const base64 = result.slice(commaIndex + 1);

        // Cancel any in-flight request and invalidate stale responses
        requestSeqRef.current += 1;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        inFlightRef.current = false;

        setIsRecognizing(false);
        setItems(null);
        setRecognitionError(null);
        setFileFormatError(null);

        setPhoto({
          name: file.name,
          mimeType,
          sizeBytes: file.size,
          previewUrl: result,
          base64,
        });
      };

      reader.onerror = () => {
        setFileFormatError("讀取圖片檔案時發生錯誤，請重新選擇。");
      };

      reader.readAsDataURL(file);
    },
    []
  );

  const runRecognition = useCallback(async () => {
    if (!photo || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setIsRecognizing(true);
    setRecognitionError(null);
    setItems(null);

    const requestId = ++requestSeqRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: photo.base64,
          mimeType: photo.mimeType,
        }),
        signal: controller.signal,
      });

      let payload: { items?: unknown; error?: unknown } | null = null;
      try {
        payload = (await response.json()) as { items?: unknown; error?: unknown };
      } catch {
        payload = null;
      }

      if (requestId !== requestSeqRef.current) {
        return;
      }

      if (!response.ok) {
        const serverMessage =
          typeof payload?.error === "string" && payload.error.trim().length > 0
            ? payload.error
            : `伺服器回傳錯誤（HTTP ${response.status}）。`;
        setRecognitionError(serverMessage);
        return;
      }

      if (
        !payload ||
        !Array.isArray(payload.items) ||
        payload.items.some((entry) => typeof entry !== "string")
      ) {
        setRecognitionError("伺服器回傳資料格式不正確，請重試。");
        return;
      }

      setItems(payload.items as string[]);
    } catch (error: unknown) {
      if (requestId !== requestSeqRef.current) {
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message =
        error instanceof Error && error.message
          ? `連線失敗（${error.message}），請檢查網路或伺服器狀態後重試。`
          : "無法連線至辨識伺服器，請稍後重試。";
      setRecognitionError(message);
    } finally {
      if (requestId === requestSeqRef.current) {
        inFlightRef.current = false;
        setIsRecognizing(false);
      }
    }
  }, [photo]);

  return (
    <div className="h-dvh w-full overflow-hidden bg-[#f3f4f1] text-[#171c19] flex flex-col">
      {/* Hidden File Input for Desktop File Dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="選擇 JPG 或 PNG 食材照片"
      />

      {/* Centered Top Device Switcher Bar */}
      <div className="shrink-0 w-full border-b border-[#e2e5de] bg-[#f8f9f6]/90 px-4 py-2.5">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <Smartphone className="w-4 h-4 text-[#166534]" aria-hidden="true" />
            <h1 className="text-[15px] font-bold tracking-tight text-[#171c19]">
              食材檢測影像辨識
            </h1>
          </div>

          {/* Interactive Device Layout Switcher */}
          <div
            role="group"
            aria-label="手機版型切換"
            className="inline-flex items-center p-1 rounded-xl bg-[#e7eae3] border border-[#dce0d7]"
          >
            {(["iphone", "android"] as const).map((type) => {
              const spec = DEVICE_SPECS[type];
              const active = device === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDevice(type)}
                  className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] ${
                    active
                      ? "bg-white text-[#171c19] shadow-xs"
                      : "text-[#58605a] hover:text-[#171c19]"
                  }`}
                >
                  {spec.label} · {spec.width}px
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Centered Mobile Portrait Frame Stage */}
      <div
        ref={stageRef}
        className="flex-1 min-h-0 w-full flex items-center justify-center p-3 overflow-hidden"
      >
        <PhoneFrame
          device={device}
          scale={scale}
          photo={photo}
          fileFormatError={fileFormatError}
          isRecognizing={isRecognizing}
          items={items}
          recognitionError={recognitionError}
          onTriggerFileSelect={handleTriggerFileSelect}
          onStartRecognize={runRecognition}
          onRetry={runRecognition}
        />
      </div>
    </div>
  );
}
