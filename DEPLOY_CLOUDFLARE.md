# Cloudflare deployment handoff

Deployment is intentionally left to the repository owner.

1. Connect this separate repository to Cloudflare Workers.
2. Use `npm run build` as the build command. The Worker entry is `src/index.ts`; static assets are in `public/`.
3. Keep the Worker name `federated-corridor-kernel` or choose another name that does not overlap World Data Federation.
4. Optional: create a KV namespace, bind it as `CORRIDOR_CACHE`, and uncomment the `kv_namespaces` stanza in `wrangler.jsonc`. Without it, the bounded memory fallback works.
5. Optional: set `OPENALEX_API_KEY` as a Worker secret for a larger OpenAlex budget. No key is required for the deterministic demo.
6. Do not configure Geo's D1 or reuse an existing domain. Verify `/api/v1/health`, `/api/v1/examples`, the inspector at `/`, and `/mcp` after deployment.

`ANTHROPIC_API_KEY` is reserved for a future opt-in M4 summarizer. The current implementation makes no AI request.
