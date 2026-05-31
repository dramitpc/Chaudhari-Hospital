import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setTokenRefresher } from "@workspace/api-client-react";

setAuthTokenGetter(() => localStorage.getItem("accessToken"));

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/login";
      return null;
    }

    const data = await res.json() as { accessToken: string; refreshToken: string };
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data.accessToken;
  } catch {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.href = "/login";
    return null;
  }
}

setTokenRefresher(doRefresh);

// Proactively refresh the access token every 12 minutes so that clinical
// workflows (writing consultations, filling prescriptions) never hit a 401
// mid-save due to token expiry.  The access token TTL is 15 minutes, so
// refreshing at 12 min keeps a comfortable 3-minute buffer.
const PROACTIVE_REFRESH_INTERVAL = 12 * 60 * 1000;

setInterval(async () => {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");
  if (!accessToken || !refreshToken) return;
  await doRefresh();
}, PROACTIVE_REFRESH_INTERVAL);

createRoot(document.getElementById("root")!).render(<App />);
