import { NextResponse } from "next/server";

/**
 * Diagnóstico temporário — não expõe valores, só presença/tamanho.
 * Remover depois de confirmar a causa do MissingSecret em produção.
 */
export async function GET() {
  const check = (name: string) => {
    const value = process.env[name];
    return { present: typeof value === "string" && value.length > 0, length: value?.length ?? 0 };
  };

  return NextResponse.json({
    vars: {
      AUTH_SECRET: check("AUTH_SECRET"),
      DATABASE_URL: check("DATABASE_URL"),
      INTEGRATIONS_ENCRYPTION_KEY: check("INTEGRATIONS_ENCRYPTION_KEY"),
      WHATSAPP_WEBHOOK_TOKEN: check("WHATSAPP_WEBHOOK_TOKEN"),
      ADMIN_EMAIL: check("ADMIN_EMAIL"),
    },
    platform: {
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
  });
}
