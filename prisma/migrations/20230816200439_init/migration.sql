-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WeatherData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" INTEGER NOT NULL,
    "temperature" REAL NOT NULL,
    "rainfall" REAL NOT NULL,
    "humidity" INTEGER NOT NULL,
    "wind_speed" INTEGER NOT NULL,
    "visibility" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
