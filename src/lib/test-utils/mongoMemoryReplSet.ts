import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

let replSet: MongoMemoryReplSet | null = null;

/**
 * Starts a single-node in-memory MongoDB replica set and points
 * MONGODB_URI at it. Only tests that exercise `session.withTransaction()`
 * need this — a standalone MongoMemoryServer (see mongoMemoryServer.ts)
 * cannot run multi-document transactions. Boots slower (~16s vs ~9-10s
 * standalone on this Windows machine) so it's only used where required.
 *
 * Note the options shape is `{ instanceOpts: [...], replSet: {...} }`,
 * NOT MongoMemoryServer's flat `{ instance: {...} }` shape — confirmed
 * against mongodb-memory-server-core's own type declarations.
 */
export async function startTestReplSet(): Promise<string> {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
  });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  return uri;
}

export async function stopTestReplSet(): Promise<void> {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
    replSet = null;
  }
}
