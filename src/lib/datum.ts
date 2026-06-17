// Server-only — never import from client components.
// Auth0 Resource Owner Password Grant → Bearer token cached per process.

const DATUM_API = "https://api.datum-rd.com";
const AUTH_URL = "https://auth.pinesoftware.com.cy/oauth/token";
const CLIENT_ID = "k6LwEcx5K9FaCEqtgfgrkgVX5edMy6zq";

let _cached: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now() / 1000;
  if (_cached && now < _cached.expiresAt - 300) return _cached.token;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: process.env.DATUM_CLIENT_SECRET,
      audience: "datum_api",
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      username: process.env.DATUM_USERNAME,
      password: process.env.DATUM_PASSWORD,
      realm: "Username-Password-Authentication",
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Auth0 ${res.status}: ${await res.text()}`);

  const body = await res.json();
  const token: string = body.access_token;
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString()
  );
  _cached = { token, expiresAt: payload.exp as number };
  return token;
}

export interface CorrBetaRow {
  x_ticker: string;
  y_ticker: string;
  corr: number;
  beta: number;
}

export async function fetchSectorBetas(
  stocks: string[],
  etf: string,
  period: string
): Promise<CorrBetaRow[]> {
  const token = await getToken();
  const params = new URLSearchParams({
    x_tickers: stocks.join(","),
    y_tickers: etf,
    period,
    as_pivot: "false",
    format: "json_records",
  });

  const res = await fetch(`${DATUM_API}/calculations/corr_beta/v2?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Datum ${res.status} [${etf}]: ${await res.text()}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
