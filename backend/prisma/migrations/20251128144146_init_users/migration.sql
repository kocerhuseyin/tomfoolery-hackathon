-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('mock', 'tum');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tumId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "faculty" TEXT,
    "semester" INTEGER,
    "profileSlug" TEXT NOT NULL,
    "authProvider" "AuthProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");
