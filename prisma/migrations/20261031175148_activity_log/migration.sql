-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "sessionId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_sessionId_at_idx" ON "Activity"("sessionId", "at");

-- CreateIndex
CREATE INDEX "Activity_at_idx" ON "Activity"("at");

-- CreateIndex
CREATE INDEX "Activity_type_at_idx" ON "Activity"("type", "at");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
