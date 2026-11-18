import React from "react";
import {
  AlertCircle,
  Check,
  HelpCircle,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanSearch,
  SearchX,
  Wifi,
} from "lucide-react";

export type DeviceType = "iphone" | "android";

export interface SelectedPhoto {
  name: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  previewUrl: string;
  base64: string;
}

export const DEVICE_SPECS: Record<
  DeviceType,
  {
    label: string;
    width: number;
    height: number;
    radiusClass: string;
  }
> = {
  iphone: {
    label: "iPhone 版型",
    width: 390,
    height: 752,
    radiusClass: "rounded-[44px]",
  },
  android: {
    label: "Android 版型",
    width: 412,
    height: 772,
    radiusClass: "rounded-[28px]",
  },
};

interface PhoneFrameProps {
  device: DeviceType;
  scale: number;
  photo: SelectedPhoto | null;
  fileFormatError: string | null;
  isRecognizing: boolean;
  items: string[] | null;
  recognitionError: string | null;
  onTriggerFileSelect: () => void;
  onStartRecognize: () => void;
  onRetry: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  device,
  scale,
  photo,
  fileFormatError,
  isRecognizing,
  items,
  recognitionError,
  onTriggerFileSelect,
  onStartRecognize,
  onRetry,
}) => {
  const spec = DEVICE_SPECS[device];
  const isNoFoodResult =
    items !== null &&
    items.length === 1 &&
    items[0].replace(/[。．.！!]/g, "").trim() === "未辨識到食材";

  return (
    <div
      className="relative flex justify-center transition-[width,height] duration-200 ease-out"
      style={{
        width: `${Math.round(spec.width * scale)}px`,
        height: `${Math.round(spec.height * scale)}px`,
      }}
    >
      {/* Hardware Shell: exact 390px (iPhone) or 412px (Android) inner frame width */}
      <div
        data-testid="phone-frame"
        data-device={device}
        className={`origin-top flex flex-col overflow-hidden bg-[#fafbf9] text-[#171c19] ring-[10px] ring-[#1d221f] shadow-[0_24px_60px_-15px_rgba(20,28,22,0.28)] select-none ${spec.radiusClass}`}
        style={{
          width: `${spec.width}px`,
          height: `${spec.height}px`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Simulated Mobile OS Status Bar */}
        {device === "iphone" ? (
          <div className="shrink-0 h-11 px-6 flex items-center justify-between bg-[#fafbf9] text-[#171c19]">
            <span className="text-[13px] font-semibold tracking-tight font-mono-tabular">
              9:41
            </span>
            {/* Hardware Dynamic Island */}
            <div
              aria-hidden="true"
              className="w-[104px] h-[26px] rounded-full bg-[#121513] flex items-center justify-end pr-2.5"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#1f2924] border border-[#2f3b35]" />
            </div>
            <div className="flex items-center gap-1.5 text-[#171c19]" aria-hidden="true">
              <div className="flex items-end gap-[1.5px] h-2.5">
                <span className="w-[2.5px] h-1 bg-current rounded-xs" />
                <span className="w-[2.5px] h-1.5 bg-current rounded-xs" />
                <span className="w-[2.5px] h-2 bg-current rounded-xs" />
                <span className="w-[2.5px] h-2.5 bg-current rounded-xs" />
              </div>
              <Wifi className="w-3.5 h-3.5 stroke-[2.2]" />
              <div className="w-5 h-2.5 rounded-[3px] border border-[#171c19]/75 p-[1.5px] flex items-center">
                <div className="w-full h-full bg-[#171c19] rounded-[1px]" />
              </div>
            </div>
          </div>
        ) : (
          <div className="shrink-0 h-9 px-5 flex items-center justify-between bg-[#fafbf9] text-[#171c19] relative">
            <span className="text-[12px] font-medium font-mono-tabular">9:41</span>
            {/* Hardware Pinhole Camera */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#121513] ring-2 ring-[#292f2b]"
            />
            <div className="flex items-center gap-1.5 text-[#171c19]" aria-hidden="true">
              <span className="text-[10px] font-semibold tracking-tight">5G</span>
              <Wifi className="w-3.5 h-3.5 stroke-[2.2]" />
              <div className="w-2.5 h-3.5 rounded-[2px] border border-[#171c19]/80 p-[1px] flex items-end">
                <div className="w-full h-3/4 bg-[#171c19] rounded-[0.5px]" />
              </div>
            </div>
          </div>
        )}

        {/* Mobile App Header */}
        <header className="shrink-0 h-[50px] px-4 bg-[#fafbf9]/95 border-b border-[#e5e8e2] flex items-center justify-between">
          <h2 className="text-[16px] font-bold tracking-tight text-[#171c19] whitespace-nowrap">
            食材檢測影像辨識
          </h2>
          <span className="text-[12px] font-mono-tabular text-[#616963] whitespace-nowrap">
            {spec.width} px
          </span>
        </header>

        {/* Scrollable Mobile Viewport Content */}
        <main className="flex-1 min-h-0 overflow-y-auto phone-scroll px-4 py-4 space-y-4 select-text">
          {/* Photo Preview Card */}
          <section aria-label="照片預覽區">
            <div className="rounded-2xl border border-[#dfe3dc] bg-white overflow-hidden">
              {photo ? (
                <>
                  <div className="relative h-[238px] w-full bg-[#eff1ec] flex items-center justify-center p-2">
                    <img
                      src={photo.previewUrl}
                      alt={`已選擇的食材照片：${photo.name}`}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
                    />
                  </div>
                  <div className="px-3.5 py-2.5 border-t border-[#eceee9] flex items-center justify-between gap-3 text-[12px] text-[#58605a]">
                    <span className="truncate font-medium text-[#272e29]">
                      {photo.name}
                    </span>
                    <span className="shrink-0 font-mono-tabular whitespace-nowrap">
                      {photo.mimeType === "image/png" ? "PNG" : "JPG"} ·{" "}
                      {formatFileSize(photo.sizeBytes)}
                    </span>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onTriggerFileSelect}
                  className="w-full h-[238px] px-6 flex flex-col items-center justify-center gap-2.5 text-center bg-white hover:bg-[#f6f8f4] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:ring-inset"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#eef2eb] text-[#3f5946] flex items-center justify-center">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-[#171c19]">
                      尚未選擇食材照片
                    </p>
                    <p className="text-[12px] text-[#606862]">
                      點擊選擇電腦中的 JPG 或 PNG 照片檔案
                    </p>
                  </div>
                </button>
              )}
            </div>

            {fileFormatError && (
              <div
                role="alert"
                className="mt-2.5 rounded-xl border border-[#f2c6c2] bg-[#fef5f4] px-3.5 py-2.5 flex items-start gap-2 text-[13px] text-[#8a1c13]"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#b42318]" />
                <span>{fileFormatError}</span>
              </div>
            )}
          </section>

          {/* Primary Action Controls */}
          <section aria-label="操作按鈕" className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onTriggerFileSelect}
              className="min-h-[46px] px-4 py-2.5 rounded-xl border border-[#cdd3ca] bg-white text-[#171c19] text-[14px] font-semibold hover:bg-[#f1f3ef] active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              <span>選擇照片</span>
            </button>

            <button
              type="button"
              disabled={!photo || isRecognizing}
              onClick={onStartRecognize}
              aria-busy={isRecognizing}
              className={`min-h-[46px] px-4 py-2.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534] focus-visible:ring-offset-2 ${
                !photo || isRecognizing
                  ? "bg-[#dde2da] text-[#7c857e] cursor-not-allowed"
                  : "bg-[#166534] text-white hover:bg-[#14532d] active:scale-[0.98] cursor-pointer shadow-sm"
              }`}
            >
              {isRecognizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>正在辨識</span>
                </>
              ) : (
                <>
                  <ScanSearch className="w-4 h-4 shrink-0" />
                  <span>開始辨識</span>
                </>
              )}
            </button>
          </section>

          {/* Recognition Output Area */}
          <section aria-label="辨識結果" aria-live="polite">
            {isRecognizing && (
              <div className="rounded-2xl border border-[#dfe3dc] bg-white p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-[14px] font-semibold text-[#171c19]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#166534] shrink-0" />
                  <span>正在辨識圖片中的水果與食材…</span>
                </div>
                <div className="space-y-2" aria-hidden="true">
                  <div className="h-3.5 w-3/4 rounded bg-[#eceee9] animate-pulse" />
                  <div className="h-3.5 w-1/2 rounded bg-[#eceee9] animate-pulse" />
                  <div className="h-3.5 w-2/3 rounded bg-[#eceee9] animate-pulse" />
                </div>
              </div>
            )}

            {!isRecognizing && recognitionError && (
              <div
                role="alert"
                className="rounded-2xl border border-[#f2c6c2] bg-[#fef5f4] p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-[#8a1c13]">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#b42318]" />
                  <h3 className="text-[14px] font-bold">辨識失敗</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-[#7a271a] break-words">
                  {recognitionError}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={!photo}
                  className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-[#b42318] text-white text-[14px] font-semibold hover:bg-[#911b12] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318]"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>重試</span>
                </button>
              </div>
            )}

            {!isRecognizing && !recognitionError && items !== null && isNoFoodResult && (
              <div className="rounded-2xl border border-[#dfe3dc] bg-white px-4 py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#f1f3ef] text-[#5c655f] flex items-center justify-center mx-auto">
                  <SearchX className="w-5 h-5" />
                </div>
                <p className="text-[15px] font-bold text-[#171c19]">未辨識到食材</p>
                <p className="text-[12px] text-[#606862] leading-relaxed">
                  圖中未看到明確的水果或食材，可更換角度或較清晰的照片重新辨識。
                </p>
              </div>
            )}

            {!isRecognizing && !recognitionError && items !== null && !isNoFoodResult && (
              <div className="rounded-2xl border border-[#dfe3dc] bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-[#eceee9] flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-[#171c19]">
                    辨識結果清單
                  </h3>
                  <span className="text-[12px] text-[#5a625c] font-mono-tabular">
                    共 {items.length} 項
                  </span>
                </div>
                <ul className="divide-y divide-[#eceee9]">
                  {items.map((item, idx) => {
                    const isUncertain = item === "無法確認";
                    return (
                      <li
                        key={`${idx}-${item}`}
                        className="px-4 py-3 min-h-[48px] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[12px] font-mono-tabular text-[#6d7670] w-5 shrink-0">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`text-[15px] font-medium break-words ${
                              isUncertain ? "text-[#7a5200]" : "text-[#171c19]"
                            }`}
                          >
                            {item}
                          </span>
                        </div>
                        {isUncertain ? (
                          <span className="shrink-0 flex items-center gap-1 text-[12px] text-[#9a6700]">
                            <HelpCircle className="w-4 h-4" />
                            <span>畫面不清</span>
                          </span>
                        ) : (
                          <Check
                            className="w-4 h-4 text-[#166534] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {!isRecognizing && !recognitionError && items === null && (
              <div className="rounded-2xl border border-[#e6eae3] bg-[#f5f7f3] px-4 py-3.5 text-[13px] text-[#555e57] leading-relaxed">
                {photo
                  ? "照片已就緒，請點擊「開始辨識」以列出圖中可見的水果或食材名稱。"
                  : "請先透過「選擇照片」匯入 JPG 或 PNG 圖片，預覽顯示後即可開始辨識。"}
              </div>
            )}
          </section>
        </main>

        {/* Simulated Mobile OS Bottom Home Indicator */}
        <div
          aria-hidden="true"
          className="shrink-0 h-6 bg-[#fafbf9] flex items-center justify-center"
        >
          <div
            className={`h-1 rounded-full bg-[#171c19]/25 ${
              device === "iphone" ? "w-32" : "w-24"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
