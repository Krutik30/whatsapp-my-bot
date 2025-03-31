-- CreateTable
CREATE TABLE "Session" (
    "pkId" SERIAL NOT NULL,
    "sessionId" VARCHAR(128) NOT NULL,
    "id" VARCHAR(255) NOT NULL,
    "data" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("pkId")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferredTime" TEXT,
    "wantsVaccine" BOOLEAN NOT NULL DEFAULT false,
    "lastStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_sessionId_idx" ON "Session"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_id_per_session_id" ON "Session"("sessionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_phoneNumber_key" ON "user_preferences"("phoneNumber");
