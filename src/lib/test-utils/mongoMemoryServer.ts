import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | null = null;

/**
 * Starts an in-memory MongoDB instance and points MONGODB_URI at it, so
 * `connectDB()` (src/lib/db.ts) — the app's single connection entrypoint —
 * is what tests exercise, instead of a second ad-hoc connection.
 */
export async function startTestDb(): Promise<string> {
  // Windows takes ~9-10s to boot mongod (FTDC performance-counter lookup
  // stalls the startup log) — past the library's default 10s launch
  // timeout, so it's raised here explicitly.
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 30000 },
  });
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  return uri;
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}
