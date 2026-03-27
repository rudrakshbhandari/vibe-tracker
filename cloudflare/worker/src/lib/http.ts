export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function unauthorized() {
  return json(
    {
      error: "Unauthorized",
    },
    { status: 401 },
  );
}

export async function parseJson<T>(request: Request) {
  return (await request.json()) as T;
}
