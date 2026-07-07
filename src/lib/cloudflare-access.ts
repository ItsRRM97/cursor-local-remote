import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const CERTS_TTL_MS = 60 * 60 * 1000;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksLoadedAt = 0;
let jwksUrl = "";

function teamDomain(): string | null {
  const raw = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function expectedAudiences(): string[] {
  const aud = process.env.CF_ACCESS_AUD?.trim();
  return aud ? [aud] : [];
}

function trustEnabled(): boolean {
  if (process.env.AUTH_TRUST_CLOUDFLARE_ACCESS === "0") return false;
  if (process.env.AUTH_TRUST_CLOUDFLARE_ACCESS === "1") return true;
  return Boolean(teamDomain() && expectedAudiences().length > 0);
}

function getJwks(domain: string) {
  const url = `https://${domain}/cdn-cgi/access/certs`;
  const now = Date.now();
  if (!jwks || jwksUrl !== url || now - jwksLoadedAt > CERTS_TTL_MS) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
    jwksLoadedAt = now;
  }
  return jwks;
}

export function isCloudflareAccessTrustEnabled(): boolean {
  return trustEnabled();
}

export async function verifyCloudflareAccessJwt(
  assertion: string,
): Promise<JWTPayload | null> {
  if (!trustEnabled()) return null;

  const domain = teamDomain();
  const audiences = expectedAudiences();
  if (!domain || audiences.length === 0) return null;

  try {
    const { payload } = await jwtVerify(assertion, getJwks(domain), {
      audience: audiences,
    });
    return payload;
  } catch {
    return null;
  }
}
