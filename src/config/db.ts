
import { MongoClient, Db } from "mongodb";

const dbName = process.env.DB_NAME || "booknook";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from environment variables.");
  }

  client = new MongoClient(uri);

  await client.connect();

  database = client.db(dbName);

  await database.command({ ping: 1 });

  console.log(`Connected to MongoDB database: ${dbName}`);

  return database;
}

export function getDB(): Db {
  if (!database) {
    throw new Error("Database is not connected yet.");
  }

  return database;
}
