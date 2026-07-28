import { z } from "zod";
import { authedQuery, createRouter } from "./middleware";
import {
  deleteWeight,
  getStartWeight,
  listCheckins,
  listWeights,
  upsertCheckin,
  upsertStartWeight,
  upsertWeight,
} from "./queries/plan";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const checkKeySchema = z.enum(["exercise", "snackFree", "weighed"]);

export const planRouter = createRouter({
  // 一次性拉取该用户的全部计划数据（前端组装成 localStorage 时代的形状）
  getData: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const [startWeight, weightRows, checkinRows] = await Promise.all([
      getStartWeight(userId),
      listWeights(userId),
      listCheckins(userId),
    ]);

    const weights: Record<string, number> = {};
    for (const row of weightRows) weights[row.date] = row.weight;

    const checkins: Record<string, Record<string, boolean>> = {};
    for (const row of checkinRows) {
      (checkins[row.date] ??= {})[row.itemKey] = row.done;
    }

    return { startWeight, weights, checkins };
  }),

  setStartWeight: authedQuery
    .input(z.object({ weight: z.number().min(20).max(300) }))
    .mutation(({ ctx, input }) =>
      upsertStartWeight(ctx.user.id, input.weight),
    ),

  setWeight: authedQuery
    .input(
      z.object({ date: dateSchema, weight: z.number().min(20).max(300) }),
    )
    .mutation(({ ctx, input }) =>
      upsertWeight(ctx.user.id, input.date, input.weight),
    ),

  removeWeight: authedQuery
    .input(z.object({ date: dateSchema }))
    .mutation(({ ctx, input }) => deleteWeight(ctx.user.id, input.date)),

  setCheckin: authedQuery
    .input(
      z.object({
        date: dateSchema,
        itemKey: checkKeySchema,
        done: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) =>
      upsertCheckin(ctx.user.id, input.date, input.itemKey, input.done),
    ),

  // 一次性导入浏览器本地数据（多设备迁移用）
  importData: authedQuery
    .input(
      z.object({
        startWeight: z.number().min(20).max(300).nullable(),
        weights: z.record(z.number().min(20).max(300)),
        checkins: z.record(z.record(checkKeySchema, z.boolean()).partial()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      if (input.startWeight != null) {
        await upsertStartWeight(userId, input.startWeight);
      }
      for (const [date, weight] of Object.entries(input.weights)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          await upsertWeight(userId, date, weight);
        }
      }
      for (const [date, items] of Object.entries(input.checkins)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        for (const [itemKey, done] of Object.entries(items)) {
          const parsed = checkKeySchema.safeParse(itemKey);
          if (parsed.success && typeof done === "boolean") {
            await upsertCheckin(userId, date, parsed.data, done);
          }
        }
      }
      return { ok: true };
    }),
});
