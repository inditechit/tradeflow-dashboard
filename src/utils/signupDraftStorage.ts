const SIGNUP_DRAFT_KEY = "mt5_signup_draft_v2";

export type SignupDraftForm = {
  name: string;
  mobile: string;
  telegram: string;
  email: string;
  password: string;
};

/** One field (or screen) at a time for manual signup. */
export type ManualSignupStep =
  | "name"
  | "mobile"
  | "telegram"
  | "email"
  | "otp"
  | "password"
  | "images";

export const MANUAL_SIGNUP_STEPS: ManualSignupStep[] = [
  "name",
  "mobile",
  "telegram",
  "email",
  "otp",
  "password",
  "images",
];

export type SignupDraft = {
  mode: "choose" | "manual";
  step: ManualSignupStep;
  form: SignupDraftForm;
  emailVerified: boolean;
};

const EMPTY_FORM: SignupDraftForm = {
  name: "",
  mobile: "",
  telegram: "",
  email: "",
  password: "",
};

export function loadSignupDraft(): SignupDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    const form = { ...EMPTY_FORM, ...(parsed.form || {}) };
    const step = MANUAL_SIGNUP_STEPS.includes(parsed.step as ManualSignupStep)
      ? (parsed.step as ManualSignupStep)
      : inferManualStep(form, Boolean(parsed.emailVerified));
    return {
      mode: parsed.mode === "manual" ? "manual" : "choose",
      step,
      form,
      emailVerified: Boolean(parsed.emailVerified),
    };
  } catch {
    return null;
  }
}

export function saveSignupDraft(draft: SignupDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function clearSignupDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function inferManualStep(form: SignupDraftForm, emailVerified: boolean): ManualSignupStep {
  if (!form.name.trim()) return "name";
  if (!form.mobile.trim()) return "mobile";
  if (!form.telegram.trim()) return "telegram";
  if (!form.email.trim()) return "email";
  if (!emailVerified) return "otp";
  if (!form.password.trim()) return "password";
  return "images";
}

export function stepIndex(step: ManualSignupStep): number {
  return MANUAL_SIGNUP_STEPS.indexOf(step);
}

export function nextStep(step: ManualSignupStep): ManualSignupStep | null {
  const i = stepIndex(step);
  if (i < 0 || i >= MANUAL_SIGNUP_STEPS.length - 1) return null;
  return MANUAL_SIGNUP_STEPS[i + 1];
}

export function prevStep(step: ManualSignupStep): ManualSignupStep | null {
  const i = stepIndex(step);
  if (i <= 0) return null;
  return MANUAL_SIGNUP_STEPS[i - 1];
}
