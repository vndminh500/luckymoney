-- Archiving categories is replaced by deleting them (see docs/progress.md).
-- Categories archived before still have their transactions, so they become
-- normal categories again; the column now marks categories that were deleted
-- while soft-deleted transactions still point to them.
UPDATE "Category" SET "archivedAt" = NULL;

ALTER TABLE "Category" RENAME COLUMN "archivedAt" TO "deletedAt";
