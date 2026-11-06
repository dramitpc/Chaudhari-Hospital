import { useEffect, useState } from "react";

/** Prepare before the user taps Print so Android's share permission stays active. */
export function usePreparedPrintPdf(createFile: () => Promise<File>, enabled: boolean) {
  const [state, setState] = useState<{
    factory: () => Promise<File>;
    file?: File;
    error?: Error;
  }>();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ factory: createFile });
    void createFile().then(
      file => { if (!cancelled) setState({ factory: createFile, file }); },
      error => { if (!cancelled) setState({ factory: createFile, error: error instanceof Error ? error : new Error("Could not prepare PDF.") }); },
    );
    return () => { cancelled = true; };
  }, [createFile, enabled]);
  const current = enabled && state?.factory === createFile ? state : undefined;
  return {
    file: current?.file,
    preparing: enabled && !current?.file && !current?.error,
  };
}
