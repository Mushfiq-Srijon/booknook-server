import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import bookRoutes from "./routes/book.routes";
import borrowRoutes from "./routes/borrow.routes";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/books", bookRoutes);
app.use("/api/borrows", borrowRoutes);

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

startServer();
