-- Add optional Clerk organization id mapping so we can link invitations and memberships
ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "clerkOrganizationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_clerkOrganizationId_key"
ON "Organization"("clerkOrganizationId")
WHERE "clerkOrganizationId" IS NOT NULL;
