-- CreateEnum
CREATE TYPE "trip_status" AS ENUM ('CREATED', 'LOADED', 'ADVANCE_PAID', 'UNLOADED', 'PROOFS_RECEIVED', 'BALANCE_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "trip_event_type" AS ENUM ('CTE_ISSUED', 'LOADING_PHOTO_ATTACHED', 'UNLOADED', 'PROOFS_RECEIVED');

-- CreateEnum
CREATE TYPE "attachment_kind" AS ENUM ('LOADING_PHOTO', 'DELIVERY_RECEIPT');

-- CreateEnum
CREATE TYPE "title_nature" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "title_kind" AS ENUM ('ADVANCE', 'BALANCE', 'CLIENT_FREIGHT');

-- CreateEnum
CREATE TYPE "title_status" AS ENUM ('OPEN', 'SCHEDULED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "paymentTermDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "pixKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "clientId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "weightKg" INTEGER NOT NULL,
    "quotedClientFreightCents" INTEGER,
    "status" "trip_status" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_agreements" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "driverFreightCents" INTEGER NOT NULL,
    "advancePercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctes" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "clientFreightCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "kind" "attachment_kind" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_events" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "type" "trip_event_type" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cteId" UUID,
    "attachmentId" UUID,
    "note" TEXT,

    CONSTRAINT "trip_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_status_changes" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "fromStatus" "trip_status",
    "toStatus" "trip_status" NOT NULL,
    "trigger" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "nature" "title_nature" NOT NULL,
    "kind" "title_kind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATE,
    "scheduledFor" DATE,
    "status" "title_status" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "paidOn" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_cnpj_key" ON "clients"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_document_key" ON "drivers"("document");

-- CreateIndex
CREATE UNIQUE INDEX "trips_code_key" ON "trips"("code");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trips_clientId_idx" ON "trips"("clientId");

-- CreateIndex
CREATE INDEX "trips_driverId_idx" ON "trips"("driverId");

-- CreateIndex
CREATE INDEX "trips_createdAt_idx" ON "trips"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "freight_agreements_tripId_key" ON "freight_agreements"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ctes_tripId_key" ON "ctes"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ctes_series_number_key" ON "ctes"("series", "number");

-- CreateIndex
CREATE INDEX "attachments_tripId_idx" ON "attachments"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_events_tripId_type_key" ON "trip_events"("tripId", "type");

-- CreateIndex
CREATE INDEX "trip_status_changes_tripId_changedAt_idx" ON "trip_status_changes"("tripId", "changedAt");

-- CreateIndex
CREATE INDEX "titles_nature_status_idx" ON "titles"("nature", "status");

-- CreateIndex
CREATE INDEX "titles_dueDate_idx" ON "titles"("dueDate");

-- CreateIndex
CREATE INDEX "titles_scheduledFor_idx" ON "titles"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "titles_tripId_kind_key" ON "titles"("tripId", "kind");

-- CreateIndex
CREATE INDEX "payments_titleId_idx" ON "payments"("titleId");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_agreements" ADD CONSTRAINT "freight_agreements_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctes" ADD CONSTRAINT "ctes_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_cteId_fkey" FOREIGN KEY ("cteId") REFERENCES "ctes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_status_changes" ADD CONSTRAINT "trip_status_changes_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
