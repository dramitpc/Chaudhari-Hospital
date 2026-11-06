type PrintDevice = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean };
};

export function usesNativePdfPrinting(device: PrintDevice = navigator): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(`${device.userAgent} ${device.userAgentData?.platform ?? ""}`)) return true;
  if (device.userAgentData?.mobile) return true;
  // Android tablets in "Desktop site" mode may identify as touch-enabled Linux.
  // iPads can likewise identify as a Mac rather than an iPad.
  return (device.maxTouchPoints ?? 0) > 0 && /Linux|Mac/i.test(`${device.platform ?? ""} ${device.userAgent}`);
}

type ShareTarget = {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
  userActivation?: { isActive: boolean };
};

function savePdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function handoffPdfForPrinting(
  file: File,
  target: ShareTarget = navigator,
  save: (file: File) => void = savePdfFile,
): Promise<"shared" | "downloaded" | "cancelled"> {
  if (file.type !== "application/pdf" || !file.size) throw new Error("A valid PDF is required for printing.");
  try {
    // Share must be invoked during the original tap, not after PDF generation.
    // Auto-print without a tap deliberately downloads instead.
    if (target.userActivation?.isActive !== false && target.share && target.canShare?.({ files: [file] })) {
      await target.share({ files: [file], title: file.name });
      return "shared";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    // HTTP NAS hosts, embedded browsers and denied permissions may block sharing.
    // Download the same PDF; never fall back to printing the HTML page.
  }
  save(file);
  return "downloaded";
}
