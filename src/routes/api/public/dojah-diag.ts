import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/dojah-diag")({
  server: {
    handlers: {
      GET: async () => {
        const appId = process.env.DOJAH_APP_ID;
        const secret = process.env.DOJAH_SECRET_KEY;
        const info = {
          hasAppId: !!appId,
          appIdLen: appId?.length ?? 0,
          hasSecret: !!secret,
          secretPrefix: secret?.slice(0, 8) ?? null,
          secretLen: secret?.length ?? 0,
        };
        if (!appId || !secret) {
          return Response.json({ ok: false, reason: "missing_creds", info });
        }
        const headers = {
          "Content-Type": "application/json",
          AppId: appId,
          Authorization: secret,
        };
        const results: Record<string, unknown> = { info };
        try {
          const r = await fetch(
            "https://sandbox.dojah.io/api/v1/kyc/nin?nin=12345678901",
            { method: "GET", headers },
          );
          results.nin_get = { status: r.status, body: (await r.text()).slice(0, 600) };
        } catch (e) {
          results.nin_get = { error: e instanceof Error ? e.message : String(e) };
        }
        try {
          const r = await fetch("https://sandbox.dojah.io/api/v1/kyc/nin/verify", {
            method: "POST",
            headers,
            body: JSON.stringify({ nin: "12345678901" }),
          });
          results.nin_post = { status: r.status, body: (await r.text()).slice(0, 600) };
        } catch (e) {
          results.nin_post = { error: e instanceof Error ? e.message : String(e) };
        }
        return Response.json({ ok: true, ...results });
      },
    },
  },
});
