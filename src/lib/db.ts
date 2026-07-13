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

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
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
        console.error("[connectDB] No se pudo conectar a MongoDB:", error);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
