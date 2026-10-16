import { env } from "../../config/env.js";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
};

export async function verifyCaptcha(token: string, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error("TURNSTILE_SECRET_KEY belum dikonfigurasi.");
  }

  if (!token || token.length > 2048) {
    return false;
  }

  // if (process.env.NODE_ENV !== "production" && env.TURNSTILE_TEST_MODE && token === "JMC_LOCAL_TEST_CAPTCHA") {
  //   return true;
  // }

  // Test key hanya diperbolehkan pada development.
  if (process.env.NODE_ENV === "production" && env.TURNSTILE_TEST_MODE) {
    throw new Error("CAPTCHA test mode tidak boleh digunakan di production.");
  }

  const body = new URLSearchParams();

  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);

  if (ip) {
    body.set("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error("CAPTCHA verification service unavailable.");
  }

  const result = (await response.json()) as TurnstileResponse;

  console.log("Turnstile verification:", {
    success: result.success,
    errorCodes: result["error-codes"],
  });

  return result.success === true;
}
