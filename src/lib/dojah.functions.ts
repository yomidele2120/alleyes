import { createServerFn } from "@tanstack/react-start";

// Dojah sandbox base URL. Live is https://api.dojah.io — same paths.
const DOJAH_BASE = "https://sandbox.dojah.io";

export type DojahNinRecord = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone_number?: string;
  nin?: string;
  photo?: string; // base64 png without data: prefix (per Dojah docs)
  nationality?: string;
  place_of_birth?: string;
  state_of_origin?: string;
  address?: string;
};

export type DojahVerifyResult = {
  ok: boolean;
  error?: string;
  record?: DojahNinRecord;
  selfie?: {
    match: boolean;
    confidenceValue: number; // 0-100
  };
  liveness?: {
    liveness_probability: number;
    quality: number;
    passed: boolean;
  };
  raw?: unknown;
};

/**
 * Dojah KYC — NIN verify with optional selfie match + liveness.
 * Sandbox test NINs: 12345678901, 70123456789.
 * Selfie must be a base64 JPEG/PNG (no data: prefix).
 */
export const dojahVerifyNin = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { nin: string; selfieBase64?: string }) => {
      if (!input?.nin || !/^\d{8,12}$/.test(input.nin)) {
        throw new Error("Invalid NIN format");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<DojahVerifyResult> => {
    const appId = process.env.DOJAH_APP_ID;
    const secret = process.env.DOJAH_SECRET_KEY;
    if (!appId || !secret) {
      return { ok: false, error: "Dojah credentials not configured" };
    }

    const headers = {
      "Content-Type": "application/json",
      AppId: appId,
      Authorization: secret,
    };

    const clean = (data.selfieBase64 || "").replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    // ---- 1. Liveness (optional, only if selfie provided) ----
    let liveness: DojahVerifyResult["liveness"];
    if (clean) {
      try {
        const res = await fetch(`${DOJAH_BASE}/api/v1/ml/liveness`, {
          method: "POST",
          headers,
          body: JSON.stringify({ image: clean }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          entity?: { liveness?: { liveness_probability?: number; quality?: number } };
        };
        const l = j?.entity?.liveness;
        if (l && typeof l.liveness_probability === "number") {
          liveness = {
            liveness_probability: l.liveness_probability,
            quality: l.quality ?? 0,
            passed: (l.liveness_probability ?? 0) >= 60,
          };
        }
      } catch {
        // non-fatal
      }
    }

    // ---- 2. NIN lookup + selfie match ----
    try {
      const body: Record<string, string> = { nin: data.nin };
      if (clean) body.selfie_image = clean;

      const res = await fetch(`${DOJAH_BASE}/api/v1/kyc/nin/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        entity?: DojahNinRecord & {
          selfie_verification?: { match?: boolean; confidence_value?: number };
        };
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        return {
          ok: false,
          error: j?.error || j?.message || `Dojah request failed (${res.status})`,
          liveness,
          raw: j,
        };
      }

      const entity = j.entity || {};
      const sv = entity.selfie_verification;

      return {
        ok: true,
        record: entity,
        selfie: sv
          ? {
              match: Boolean(sv.match),
              confidenceValue: Number(sv.confidence_value ?? 0),
            }
          : undefined,
        liveness,
        raw: j,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        liveness,
      };
    }
  });
