const SIGNUP_DRAFT_KEY = "mt5_signup_draft_v1";

export type SignupDraftForm = {
  name: string;
  mobile: string;
  telegram: string;
  password: string;
  email: string;
};

export type AccountFieldStep = "name" | "mobile" | "telegram" | "password" | "legal";

export const ACCOUNT_FIELD_ORDER: AccountFieldStep[] = [
  "name",
  "mobile",
  "telegram",
  "password",
  "legal",
];

export type SignupDraft = {
  step: 1 | 2;
  form: SignupDraftForm;
  accountFieldStep?: AccountFieldStep;
};

const EMPTY_FORM: SignupDraftForm = {
  name: "",
  mobile: "",
  telegram: "",
  password: "",
  email: "",
};

export function loadSignupDraft(): SignupDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const step = parsed.step === 2 ? 2 : 1;
    const form = { ...EMPTY_FORM, ...(parsed.form || {}) };
    const accountFieldStep = ACCOUNT_FIELD_ORDER.includes(
      parsed.accountFieldStep as AccountFieldStep,
    )
      ? (parsed.accountFieldStep as AccountFieldStep)
      : inferAccountFieldStep(form);
    return { step, form, accountFieldStep };
  } catch {
    return null;
  }
}

export function saveSignupDraft(draft: SignupDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota exceeded — ignore
  }
}

export function inferAccountFieldStep(form: SignupDraftForm): AccountFieldStep {
  if (!form.name.trim()) return "name";
  if (!form.mobile.trim()) return "mobile";
  if (!form.telegram.trim()) return "telegram";
  if (!form.password.trim()) return "password";
  return "legal";
}

export function accountFieldStepFromError(message: string): AccountFieldStep | null {
  const m = message.toLowerCase();
  if (m.includes("privacy") || m.includes("terms") || m.includes("refund") || m.includes("accept")) {
    return "legal";
  }
  if (m.includes("password")) return "password";
  if (m.includes("telegram")) return "telegram";
  if (m.includes("mobile") || m.includes("phone")) return "mobile";
  if (m.includes("name")) return "name";
  return null;
}

export function clearSignupDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export type SignupErrorTarget =
  | "step1"
  | "email"
  | "otp"
  | "permissions"
  | "photo"
  | "general";

/** Map server / validation messages to the signup section the user should see. */
export function inferSignupErrorTarget(message: string): SignupErrorTarget {
  const m = message.toLowerCase();
  if (m.includes("photo") || m.includes("camera") || m.includes("capture")) return "photo";
  if (m.includes("permission") || m.includes("location") || m.includes("camera is not")) {
    return "permissions";
  }
  if (m.includes("otp") || m.includes("verification code")) return "otp";
  if (
    m.includes("email") ||
    m.includes("already exists") ||
    m.includes("duplicate")
  ) {
    return "email";
  }
  if (
    m.includes("name") ||
    m.includes("mobile") ||
    m.includes("phone") ||
    m.includes("telegram") ||
    m.includes("password")
  ) {
    return "step1";
  }
  return "general";
}
