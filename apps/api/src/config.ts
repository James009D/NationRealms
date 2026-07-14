import { z } from "zod";

const configSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATA_MODE: z.enum(["postgres", "memory"]).default("postgres"),
    AUTH_MODE: z.enum(["demo", "session"]).default("demo"),
    DATABASE_URL: z.string().optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_HOST: z.string().default("0.0.0.0"),
    CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174"),
    SESSION_COOKIE_NAME: z.string().default("statecraft_session"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SESSION_SECRET: z.string().min(32).default("development-only-session-secret-change-me"),
    SLOW_REQUEST_MS: z.coerce.number().int().min(50).default(750),
    RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120)
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.DATA_MODE === "memory") {
      context.addIssue({ code: "custom", message: "DATA_MODE=memory is forbidden in production", path: ["DATA_MODE"] });
    }
    if (value.NODE_ENV === "production" && value.AUTH_MODE === "demo") {
      context.addIssue({ code: "custom", message: "AUTH_MODE=demo is forbidden in production", path: ["AUTH_MODE"] });
    }
    if (value.NODE_ENV === "production" && value.SESSION_SECRET === "development-only-session-secret-change-me") {
      context.addIssue({
        code: "custom",
        message: "SESSION_SECRET must be changed in production",
        path: ["SESSION_SECRET"]
      });
    }
    if (value.DATA_MODE === "postgres" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        message: "DATABASE_URL is required in postgres mode",
        path: ["DATABASE_URL"]
      });
    }
  });

export type RuntimeConfig = z.infer<typeof configSchema>;

let cachedConfig: RuntimeConfig | null = null;

export function getConfig(): RuntimeConfig {
  if (!cachedConfig) {
    const environment = {
      ...process.env,
      DATA_MODE: process.env.STATECRAFT_FORCE_DB_FALLBACK === "1" ? "memory" : process.env.DATA_MODE
    };
    cachedConfig = configSchema.parse(environment);
  }
  return cachedConfig;
}

export function resetConfigForTests() {
  cachedConfig = null;
}
