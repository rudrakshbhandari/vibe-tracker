type CookieOptions = {
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

function parseCookieHeader(header: string | null) {
  if (!header) {
    return new Map<string, string>();
  }

  return new Map(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        const key =
          separatorIndex === -1 ? part : part.slice(0, separatorIndex).trim();
        const value =
          separatorIndex === -1 ? "" : part.slice(separatorIndex + 1).trim();
        return [key, decodeURIComponent(value)] as const;
      }),
  );
}

export function getCookie(request: Request, name: string) {
  return parseCookieHeader(request.headers.get("cookie")).get(name);
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function appendCookie(headers: Headers, cookie: string) {
  headers.append("Set-Cookie", cookie);
}
