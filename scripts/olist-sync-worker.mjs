import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp() {
  return new Date().toISOString();
}

function log(message, meta) {
  if (meta) {
    console.log(`[${timestamp()}] ${message}`, meta);
    return;
  }

  console.log(`[${timestamp()}] ${message}`);
}

loadEnvFile(envPath);

const baseUrl = (
  process.env.OLIST_SYNC_WORKER_URL ||
  process.env.SITE_URL ||
  "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const syncSecret = String(process.env.OLIST_SYNC_SECRET || "").trim();
const stepDelayMs = Math.max(
  1000,
  Number(process.env.OLIST_SYNC_STEP_DELAY_MS || 2000),
);
const retryDelayMs = Math.max(
  1000,
  Number(process.env.OLIST_SYNC_RETRY_DELAY_MS || 5000),
);
const endpoint = `${baseUrl}/api/cron/olist/sync`;

if (!syncSecret) {
  console.error("OLIST_SYNC_SECRET ausente. Worker nao pode iniciar.");
  process.exit(1);
}

async function runStep() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-olist-sync-secret": syncSecret,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    ok: response.ok && data?.ok === true,
    data,
  };
}

async function main() {
  log("Worker de sync da Olist iniciado.", {
    endpoint,
    stepDelayMs,
    retryDelayMs,
  });

  while (true) {
    try {
      const result = await runStep();

      if (result.ok) {
        log("Sync executado.", {
          pageStart: result.data?.pageStart ?? null,
          offsetStart: result.data?.offsetStart ?? null,
          nextPage: result.data?.nextPage ?? null,
          nextOffset: result.data?.nextOffset ?? null,
          updated: result.data?.updated ?? 0,
          restartedFromBeginning: Boolean(result.data?.restartedFromBeginning),
        });
        await sleep(stepDelayMs);
        continue;
      }

      if (result.status === 429 || result.data?.rateLimited) {
        log("Tiny bloqueou temporariamente o sync. Aguardando para retomar.", {
          retryAfterMs: Number(result.data?.retryAfterMs || retryDelayMs),
          error: result.data?.error || null,
        });
        await sleep(Number(result.data?.retryAfterMs || retryDelayMs));
        continue;
      }

      log("Sync retornou erro. Aguardando para tentar novamente.", {
        status: result.status,
        error: result.data?.error || "olist_sync_failed",
      });
      await sleep(retryDelayMs);
    } catch (error) {
      log("Falha de rede no worker de sync. Aguardando para retomar.", {
        error: error instanceof Error ? error.message : "network_error",
      });
      await sleep(retryDelayMs);
    }
  }
}

main().catch((error) => {
  console.error("Worker de sync da Olist falhou ao iniciar.", error);
  process.exit(1);
});
