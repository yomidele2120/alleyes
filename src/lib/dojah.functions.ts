import { createServerFn } from "@tanstack/react-start";

// Dojah sandbox base URL. Live: https://api.dojah.io — same paths.
const DOJAH_BASE = "https://sandbox.dojah.io";

export type DojahNinRecord = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone_number?: string;
  nin?: string;
  photo?: string; // base64 (no data: prefix)
  nationality?: string;
  place_of_birth?: string;
  state_of_origin?: string;
  address?: string;
  email?: string;
  marital_status?: string;
};

export type DojahBvnRecord = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone_number1?: string;
  phone_number2?: string;
  bvn?: string;
  image?: string; // base64
  nationality?: string;
  state_of_origin?: string;
  state_of_residence?: string;
  residential_address?: string;
  enrollment_bank?: string;
  enrollment_branch?: string;
  email?: string;
  marital_status?: string;
};

export type DojahVerifyResult = {
  ok: boolean;
  error?: string;
  record?: DojahNinRecord;
  selfie?: { match: boolean; confidenceValue: number };
  liveness?: { liveness_probability: number; quality: number; passed: boolean };
};

export type DojahBvnResult = {
  ok: boolean;
  error?: string;
  record?: DojahBvnRecord;
};

export type DojahAmlHit = {
  source?: string;
  name?: string;
  category?: string;
  country?: string;
  designation?: string;
  date_of_birth?: string;
  match_percentage?: number;
};

export type DojahAmlResult = {
  ok: boolean;
  error?: string;
  hits: DojahAmlHit[];
  clean: boolean;
};

function creds() {
  const appId = process.env.DOJAH_APP_ID;
  const secret = process.env.DOJAH_SECRET_KEY;
  if (!appId || !secret) return null;
  return {
    "Content-Type": "application/json",
    AppId: appId,
    Authorization: secret,
  };
}

/**
 * NIN verify + optional selfie match + liveness.
 * Sandbox test NIN: 12345678901.
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
    const headers = creds();
    if (!headers) return { ok: false, error: "Dojah credentials not configured" };

    const clean = (data.selfieBase64 || "").replace(/^data:image\/[a-zA-Z]+;base64,/, "");

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
        /* non-fatal */
      }
    }

    // Try POST /kyc/nin/verify (with selfie match support); fall back to GET /kyc/nin.
    try {
      let entity: (DojahNinRecord & {
        selfie_verification?: { match?: boolean; confidence_value?: number };
      }) | undefined;
      let errMsg: string | undefined;

      if (clean) {
        const res = await fetch(`${DOJAH_BASE}/api/v1/kyc/nin/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({ nin: data.nin, selfie_image: clean }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          entity?: typeof entity;
          error?: string;
          message?: string;
        };
        if (res.ok) entity = j.entity;
        else errMsg = j?.error || j?.message || `Dojah error ${res.status}`;
      }

      if (!entity) {
        // basic lookup
        const res = await fetch(
          `${DOJAH_BASE}/api/v1/kyc/nin?nin=${encodeURIComponent(data.nin)}`,
          { method: "GET", headers },
        );
        const j = (await res.json().catch(() => ({}))) as {
          entity?: DojahNinRecord;
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          return {
            ok: false,
            error: j?.error || j?.message || errMsg || `Dojah error ${res.status}`,
            liveness,
          };
        }
        entity = j.entity;
      }

      const sv = entity?.selfie_verification;
      return {
        ok: true,
        record: entity,
        selfie: sv
          ? { match: Boolean(sv.match), confidenceValue: Number(sv.confidence_value ?? 0) }
          : undefined,
        liveness,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        liveness,
      };
    }
  });

/**
 * Full BVN lookup. Sandbox test BVN: 22222222222.
 */
export const dojahLookupBvn = createServerFn({ method: "POST" })
  .inputValidator((input: { bvn: string }) => {
    if (!input?.bvn || !/^\d{11}$/.test(input.bvn)) {
      throw new Error("BVN must be 11 digits");
    }
    return input;
  })
  .handler(async ({ data }): Promise<DojahBvnResult> => {
    const headers = creds();
    if (!headers) return { ok: false, error: "Dojah credentials not configured" };
    try {
      const res = await fetch(
        `${DOJAH_BASE}/api/v1/kyc/bvn/full?bvn=${encodeURIComponent(data.bvn)}`,
        { method: "GET", headers },
      );
      const j = (await res.json().catch(() => ({}))) as {
        entity?: DojahBvnRecord;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        return { ok: false, error: j?.error || j?.message || `Dojah error ${res.status}` };
      }
      return { ok: true, record: j.entity };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  });

/**
 * AML / watchlist screening (PEP, sanctions, adverse media).
 */
export const dojahAmlScreen = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { first_name: string; last_name: string; date_of_birth?: string }) => {
      if (!input?.first_name || !input?.last_name) {
        throw new Error("First and last name required");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<DojahAmlResult> => {
    const headers = creds();
    if (!headers) return { ok: false, error: "Dojah credentials not configured", hits: [], clean: false };
    try {
      const res = await fetch(`${DOJAH_BASE}/api/v1/aml/screening/info`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          ...(data.date_of_birth ? { date_of_birth: data.date_of_birth } : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        entity?: {
          aml?: {
            watchlist?: Array<Record<string, unknown>>;
            hit_count?: number;
          };
        };
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        return {
          ok: false,
          error: j?.error || j?.message || `Dojah error ${res.status}`,
          hits: [],
          clean: false,
        };
      }
      const raw = j.entity?.aml?.watchlist ?? [];
      const hits: DojahAmlHit[] = raw.map((h) => ({
        source: (h.source as string) || (h.list as string) || undefined,
        name: (h.name as string) || undefined,
        category: (h.category as string) || (h.list_type as string) || undefined,
        country: (h.country as string) || undefined,
        designation: (h.designation as string) || (h.position as string) || undefined,
        date_of_birth: (h.date_of_birth as string) || undefined,
        match_percentage: (h.match_percentage as number) || undefined,
      }));
      return { ok: true, hits, clean: hits.length === 0 };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        hits: [],
        clean: false,
      };
    }
  });
