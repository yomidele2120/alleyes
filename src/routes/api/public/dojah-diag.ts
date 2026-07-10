import { createFileRoute } from "@tanstack/react-router";

// Temporary diagnostic — tests Dojah sandbox connectivity + credentials.
// Safe: returns only shape/status info, never the secret values themselves.
export const Route = createFileRoute("/api/public/dojah-diag")({
  server: {
    handlers: {
      GET: async () => {
        const appId = process.env.DOJAH_APP_ID;
        const secret = process.env.DOJAH_SECRET_KEY;
        const pub = process.env.DOJAH_PUBLIC_KEY;

        const creds = {
          hasAppId: !!appId,
          appIdLen: appId?.length ?? 0,
          hasSecret: !!secret,
          secretPrefix: secret?.slice(0, 8) ?? null,
          secretLen: secret?.length ?? 0,
          hasPublic: !!pub,
          publicPrefix: pub?.slice(0, 8) ?? null,
        };

        if (!appId || !secret) {
          return Response.json({ ok: false, reason: "missing_creds", creds });
        }

        const headers = {
          "Content-Type": "application/json",
          AppId: appId,
          Authorization: secret,
        };

        const results: Record<string, unknown> = { creds };

        // 1. Basic NIN GET lookup (sandbox test NIN)
        try {
          const r = await fetch(
            "https://sandbox.dojah.io/api/v1/kyc/nin?nin=12345678901",
            { method: "GET", headers },
          );
          const text = await r.text();
          results.nin_get = { status: r.status, body: text.slice(0, 800) };
        } catch (e) {
          results.nin_get = { error: e instanceof Error ? e.message : String(e) };
        }

        // 2. POST /kyc/nin/verify (what dojah.functions.ts uses)
        try {
          const r = await fetch(
            "https://sandbox.dojah.io/api/v1/kyc/nin/verify",
            {
              method: "POST",
              headers,
              body: JSON.stringify({ nin: "12345678901" }),
            },
          );
          const text = await r.text();
          results.nin_verify_post = { status: r.status, body: text.slice(0, 800) };
        } catch (e) {
          results.nin_verify_post = { error: e instanceof Error ? e.message : String(e) };
        }

        return Response.json({ ok: true, ...results });
      },
    },
  },
});
