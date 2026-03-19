const DEV_FALLBACK_SECRET = "dev-secret-troque-isso";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function normalizeSecret(value: string | undefined | null) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function resolveSecret(...candidates: Array<string | undefined | null>) {
  for (const candidate of candidates) {
    const normalized = normalizeSecret(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return isProduction() ? "" : DEV_FALLBACK_SECRET;
}

function isWeakSecret(value: string) {
  const normalized = normalizeSecret(value).toLowerCase();
  return (
    !normalized ||
    normalized.includes("dev-secret") ||
    normalized.includes("troque-isso") ||
    normalized.includes("change-me") ||
    normalized.length < 24
  );
}

function requireResolvedSecret(
  label: string,
  ...candidates: Array<string | undefined | null>
) {
  const secret = resolveSecret(...candidates);

  if (!secret) {
    throw new Error(`${label}_not_configured`);
  }

  return secret;
}

export function getJwtSecret() {
  return resolveSecret(process.env.JWT_SECRET);
}

export function requireJwtSecret() {
  return requireResolvedSecret("jwt_secret", process.env.JWT_SECRET);
}

export function getAdminSessionSecret() {
  return resolveSecret(process.env.ADMIN_SESSION_SECRET, process.env.JWT_SECRET);
}

export function requireAdminSessionSecret() {
  return requireResolvedSecret(
    "admin_session_secret",
    process.env.ADMIN_SESSION_SECRET,
    process.env.JWT_SECRET,
  );
}

export function getOrderAccessSecret() {
  return resolveSecret(process.env.ORDER_ACCESS_SECRET, process.env.JWT_SECRET);
}

export function requireOrderAccessSecret() {
  return requireResolvedSecret(
    "order_access_secret",
    process.env.ORDER_ACCESS_SECRET,
    process.env.JWT_SECRET,
  );
}

export function getEmailVerificationSecret() {
  return resolveSecret(
    process.env.EMAIL_VERIFICATION_SECRET,
    process.env.JWT_SECRET,
  );
}

export function requireEmailVerificationSecret() {
  return requireResolvedSecret(
    "email_verification_secret",
    process.env.EMAIL_VERIFICATION_SECRET,
    process.env.JWT_SECRET,
  );
}

export function getPasswordResetSecret() {
  return resolveSecret(process.env.PASSWORD_RESET_SECRET, process.env.JWT_SECRET);
}

export function requirePasswordResetSecret() {
  return requireResolvedSecret(
    "password_reset_secret",
    process.env.PASSWORD_RESET_SECRET,
    process.env.JWT_SECRET,
  );
}

export function requireConfiguredSecret(envName: string) {
  const secret = normalizeSecret(process.env[envName]);
  if (!secret) {
    throw new Error(`${envName.toLowerCase()}_not_configured`);
  }
  return secret;
}

let validated = false;

export function validateCriticalEnvironment() {
  if (validated || !isProduction()) {
    return;
  }

  const errors: string[] = [];
  const checks = [
    { name: "JWT_SECRET", value: getJwtSecret() },
    { name: "ADMIN_SESSION_SECRET/JWT_SECRET", value: getAdminSessionSecret() },
    { name: "ORDER_ACCESS_SECRET/JWT_SECRET", value: getOrderAccessSecret() },
    { name: "EMAIL_VERIFICATION_SECRET/JWT_SECRET", value: getEmailVerificationSecret() },
    { name: "PASSWORD_RESET_SECRET/JWT_SECRET", value: getPasswordResetSecret() },
  ];

  for (const check of checks) {
    if (isWeakSecret(check.value)) {
      errors.push(`${check.name} ausente ou fraco em producao`);
    }
  }

  if (process.env.RESEND_API_KEY && !normalizeSecret(process.env.EMAIL_FROM)) {
    errors.push("EMAIL_FROM ausente enquanto RESEND_API_KEY esta configurado");
  }

  if (process.env.PUSHINPAY_TOKEN && !normalizeSecret(process.env.PUSHINPAY_WEBHOOK_SECRET)) {
    errors.push("PUSHINPAY_WEBHOOK_SECRET ausente enquanto PUSHINPAY_TOKEN esta configurado");
  }

  if (
    process.env.MERCADOPAGO_ACCESS_TOKEN &&
    !normalizeSecret(process.env.MERCADOPAGO_WEBHOOK_SECRET)
  ) {
    errors.push(
      "MERCADOPAGO_WEBHOOK_SECRET ausente enquanto MERCADOPAGO_ACCESS_TOKEN esta configurado",
    );
  }

  if (errors.length > 0) {
    throw new Error(`critical_environment_invalid:${errors.join("; ")}`);
  }

  validated = true;
}
