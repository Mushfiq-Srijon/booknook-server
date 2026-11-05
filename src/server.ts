import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import bookRoutes from "./routes/book.routes";
import borrowRoutes from "./routes/borrow.routes";
import authRoutes from "./routes/auth.routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or serverless warmups)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// Auto-connect to MongoDB across serverless container invocations
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

app.use("/api/books", bookRoutes);
app.use("/api/borrows", borrowRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the BookNook API!",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BookNook server is running.",
  });
});

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`BookNook server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start BookNook server:", error);
    process.exit(1);
  }
}

// Only listen on port in non-serverless environments (local dev / Render)
if (!process.env.VERCEL) {
  startServer();
}

export default app;
