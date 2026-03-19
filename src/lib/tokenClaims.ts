export const JWT_ISSUER = "papelaria-felicio";

export const JWT_AUDIENCE = {
  session: "pf-session",
  admin: "pf-admin",
  orderAccess: "pf-order-access",
  emailVerification: "pf-email-verification",
  passwordReset: "pf-password-reset",
} as const;
