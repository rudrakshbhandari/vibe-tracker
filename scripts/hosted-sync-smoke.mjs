const baseUrl = process.argv[2] ?? process.env.HOSTED_SMOKE_URL;
const smokeSecret = process.env.SMOKE_TEST_SECRET;

if (!baseUrl) {
  console.error("Missing smoke-test base URL");
  process.exit(1);
}

if (!smokeSecret) {
  console.error("Missing SMOKE_TEST_SECRET");
  process.exit(1);
}

const response = await fetch(new URL("/api/smoke/github-sync", baseUrl), {
  headers: {
    authorization: `Bearer ${smokeSecret}`,
  },
});

const payload = await response.json().catch(() => null);

if (!response.ok) {
  console.error(
    JSON.stringify(
      {
        status: response.status,
        payload,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
