import { pgTable, index, integer, varchar, timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const bitmemesPost = pgTable("bitmemes_post", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "bitmemes_post_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	name: varchar({ length: 256 }),
	createdAt: timestamp({ withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
}, (table) => [
	index("name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);
