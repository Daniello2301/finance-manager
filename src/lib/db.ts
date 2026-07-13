import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseConn: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__mongooseConn ?? {
  conn: null,
  promise: null,
};
globalThis.__mongooseConn = cached;

// Some driver failure modes (malformed URI, certain auth errors) embed the
// full connection string — including the username/password — verbatim in
// the error message. Never log an error without stripping that out first.
export function redactMongoUri(message: string): string {
  return message.replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]+@/gi, "$1***:***@");
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    // Recheck readyState even when cached — a connection that was healthy
    // at first-connect can still drop later (server restart, network
    // partition). Without this, every subsequent call would keep returning
    // the same dead connection object forever instead of reconnecting.
    if (cached.conn.connection.readyState === 1) {
      return cached.conn;
    }
    // `cached.promise` already resolved to this same now-dead connection —
    // it must be cleared too, or the code below would just re-await it and
    // hand back the identical stale object instead of reconnecting.
    cached.conn = null;
    cached.promise = null;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI no está definida. Configúrala en .env.local."
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
      .catch((error) => {
        // Without this, a failed first connection leaves `cached.promise`
        // permanently rejected — every subsequent connectDB() call would
        // instantly re-throw the same stale error, even after the network
        // issue clears up, until the dev server is restarted.
        cached.promise = null;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          "[connectDB] No se pudo conectar a MongoDB:",
          redactMongoUri(message)
        );
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
