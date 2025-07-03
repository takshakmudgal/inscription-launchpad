-- Migration: Add competition tracking fields to block_tracker
-- This enables tracking consecutive blocks without launches for the 5-block reset rule

ALTER TABLE "bitmemes"."bitmemes_block_tracker" 
ADD COLUMN "consecutive_blocks_without_launches" integer DEFAULT 0 NOT NULL;

ALTER TABLE "bitmemes"."bitmemes_block_tracker" 
ADD COLUMN "last_launch_block" integer;

-- Update existing records to have zero consecutive blocks
UPDATE "bitmemes"."bitmemes_block_tracker" 
SET "consecutive_blocks_without_launches" = 0 
WHERE "consecutive_blocks_without_launches" IS NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS "block_tracker_block_idx" ON "bitmemes"."bitmemes_block_tracker" USING btree ("last_processed_block" ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS "block_tracker_checked_idx" ON "bitmemes"."bitmemes_block_tracker" USING btree ("last_checked" ASC NULLS LAST); 