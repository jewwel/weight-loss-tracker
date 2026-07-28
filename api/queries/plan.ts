import { and, eq } from "drizzle-orm";
import { checkins, planSettings, weightEntries } from "@db/schema";
import { getDb } from "./connection";

export async function getStartWeight(userId: number) {
  const row = await getDb().query.planSettings.findFirst({
    where: eq(planSettings.userId, userId),
  });
  return row?.startWeight ?? null;
}

export async function upsertStartWeight(userId: number, startWeight: number) {
  await getDb()
    .insert(planSettings)
    .values({ userId, startWeight })
    .onDuplicateKeyUpdate({ set: { startWeight } });
}

export async function listWeights(userId: number) {
  return getDb()
    .select({ date: weightEntries.date, weight: weightEntries.weight })
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId));
}

export async function upsertWeight(
  userId: number,
  date: string,
  weight: number,
) {
  await getDb()
    .insert(weightEntries)
    .values({ userId, date, weight })
    .onDuplicateKeyUpdate({ set: { weight } });
}

export async function deleteWeight(userId: number, date: string) {
  await getDb()
    .delete(weightEntries)
    .where(and(eq(weightEntries.userId, userId), eq(weightEntries.date, date)));
}

export async function listCheckins(userId: number) {
  return getDb()
    .select({
      date: checkins.date,
      itemKey: checkins.itemKey,
      done: checkins.done,
    })
    .from(checkins)
    .where(eq(checkins.userId, userId));
}

export async function upsertCheckin(
  userId: number,
  date: string,
  itemKey: string,
  done: boolean,
) {
  await getDb()
    .insert(checkins)
    .values({ userId, date, itemKey, done })
    .onDuplicateKeyUpdate({ set: { done } });
}
