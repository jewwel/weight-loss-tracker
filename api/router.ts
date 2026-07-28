import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { planRouter } from "./planRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  plan: planRouter,
});

export type AppRouter = typeof appRouter;
