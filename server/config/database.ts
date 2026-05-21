import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __shopnixMongoose: MongooseCache | undefined;
}

const cache: MongooseCache = global.__shopnixMongoose ?? {
  conn: null,
  promise: null,
};
global.__shopnixMongoose = cache;

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it in Vercel → Settings → Environment Variables."
    );
  }
  if (process.env.VERCEL && uri.includes("127.0.0.1")) {
    throw new Error(
      "MONGODB_URI points to localhost. Use your MongoDB Atlas connection string on Vercel."
    );
  }
  return uri;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }

  if (!cache.promise) {
    const uri = getMongoUri();
    cache.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 20000,
        maxPoolSize: 10,
        bufferCommands: false,
        family: 4,
      })
      .then((m) => {
        console.log("[db] MongoDB connected");
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        console.error("[db] MongoDB connection failed:", err.message);
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
