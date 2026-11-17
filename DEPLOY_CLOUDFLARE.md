# Cloudflare deployment handoff

Deployment is intentionally left to the repository owner.

1. Connect this separate repository to Cloudflare Workers.
2. Use `npm run build` as the build command. The Worker entry is `src/index.ts`; static assets are in `public/`.
3. Keep the Worker name `federated-corridor-kernel` or choose another name that does not overlap World Data Federation.
4. Optional: create a KV namespace, bind it as `CORRIDOR_CACHE`, and uncomment the `kv_namespaces` stanza in `wrangler.jsonc`. Without it, the bounded memory fallback works.
5. Optional: set `OPENALEX_API_KEY` and/or `OPENFDA_API_KEY` as Worker secrets for larger provider budgets. `USPTO_ODP_API_KEY` is accepted for future verified enrichment, but v0.3 does not assume ODP application search substitutes for patent-grant/government-interest data. No key is required.
6. Do not configure Geo's D1 or reuse an existing domain. Verify `/api/v1/health`, `/api/v1/examples`, the inspector at `/`, and `/mcp` after deployment.

Do not deploy as part of the v0.3 milestone and do not change existing bindings or domains. The current implementation makes no AI request.
