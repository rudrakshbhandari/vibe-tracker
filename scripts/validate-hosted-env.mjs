const requiredEnvKeys = [
  "APP_URL",
  "GITHUB_APP_ID",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_SLUG",
  "SESSION_ENCRYPTION_KEY",
];

const databaseEnvKeys = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];

function firstConfiguredEnvValue(envKeys) {
  for (const envKey of envKeys) {
    const value = process.env[envKey];

    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function isVercelProductionBuild() {
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
}

if (!isVercelProductionBuild()) {
  process.exit(0);
}

const missingEnvKeys = requiredEnvKeys.filter((envKey) => {
  const value = process.env[envKey];
  return !value || value.trim().length === 0;
});

const databaseUrl = firstConfiguredEnvValue(databaseEnvKeys);

if (!databaseUrl) {
  missingEnvKeys.push("DATABASE_URL | POSTGRES_PRISMA_URL | POSTGRES_URL");
} else if (databaseUrl.startsWith("file:")) {
  missingEnvKeys.push("durable Postgres database url");
}

if (missingEnvKeys.length > 0) {
  console.error(
    [
      "Hosted GitHub sync is misconfigured for this Vercel production build.",
      "Missing or invalid env:",
      ...missingEnvKeys.map((envKey) => `- ${envKey}`),
    ].join("\n"),
  );
  process.exit(1);
}
