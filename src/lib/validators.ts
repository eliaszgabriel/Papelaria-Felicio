/** Remove tudo que não for dígito */
export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

/** Validação real de CPF (dígitos verificadores) */
export function isValidCPF(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 11) return false;
  // sequências inválidas
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Máscara CPF: 000.000.000-00 */
export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Formata CPF sem máscara (só dígitos) para exibição */
export function formatCPF(raw: string) {
  return maskCPF(onlyDigits(raw));
}

/** Máscara telefone BR: (11) 99999-9999 */
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara CEP: 00000-000 */
export function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, reason: "Senha e obrigatoria." };
  }

  if (password.length < 10) {
    return {
      valid: false,
      reason: "Senha deve ter pelo menos 10 caracteres.",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      reason: "Senha muito longa. Use ate 128 caracteres.",
    };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const complexity = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (complexity < 3) {
    return {
      valid: false,
      reason:
        "Senha deve combinar pelo menos 3 destes grupos: minusculas, maiusculas, numeros e simbolos.",
    };
  }

  const lower = password.toLowerCase();
  const commonPatterns = [
    "123456",
    "12345678",
    "123456789",
    "password",
    "senha123",
    "qwerty",
    "admin123",
  ];

  if (commonPatterns.some((pattern) => lower.includes(pattern))) {
    return {
      valid: false,
      reason: "Senha muito comum. Escolha uma combinacao mais forte.",
    };
  }

  if (/(.)\1{2,}/.test(password)) {
    return {
      valid: false,
      reason: "Evite repetir o mesmo caractere varias vezes seguidas na senha.",
    };
  }

  return { valid: true };
}
