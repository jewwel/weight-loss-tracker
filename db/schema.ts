import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  float,
  boolean,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 用户计划设置（每用户一行）
export const planSettings = mysqlTable("plan_settings", {
  userId: bigint("userId", { mode: "number", unsigned: true })
    .primaryKey()
    .notNull(),
  startWeight: float("startWeight"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type PlanSettings = typeof planSettings.$inferSelect;

// 每日体重记录（date 格式 YYYY-MM-DD）
export const weightEntries = mysqlTable(
  "weight_entries",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    weight: float("weight").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: uniqueIndex("weight_user_date_idx").on(
      table.userId,
      table.date,
    ),
  }),
);

export type WeightEntry = typeof weightEntries.$inferSelect;

// 每日打卡记录（itemKey: exercise / diet / weigh）
export const checkins = mysqlTable(
  "checkins",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    itemKey: varchar("itemKey", { length: 32 }).notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userDateItemIdx: uniqueIndex("checkin_user_date_item_idx").on(
      table.userId,
      table.date,
      table.itemKey,
    ),
  }),
);

export type Checkin = typeof checkins.$inferSelect;
//
// Example:
// export const posts = mysqlTable("posts", {
//   id: serial("id").primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
//
// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()
