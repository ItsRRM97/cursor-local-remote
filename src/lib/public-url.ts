import { getNetworkInfo } from "@/lib/network";
import { DEFAULT_PORT } from "@/lib/constants";

export function getPublicBaseUrl(): string {
  const configured = process.env.PUBLIC_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  return getNetworkInfo(port).url;
}
