
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import { GridFSBucket } from "mongodb";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/filedb";

// ---------- DB connection ----------
let gfsBucket = null;
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.once("open", () => {
  console.log("MongoDB connected");
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });
});

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Multer / GridFS ----------
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: "uploads",
    };
  },
});
const upload = multer({ storage });

// ---------- Helpers ----------
function ensureGfsReady(res) {
  if (!gfsBucket) {
    res.status(503).json({ error: "Storage not ready. Try again shortly." });
    return false;
  }
  return true;
}

// ---------- Routes ----------
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ file: req.file });
});

app.get("/files", async (req, res) => {
  if (!ensureGfsReady(res)) return;
  try {
    const files = await gfsBucket.find().toArray();
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/files/:id", async (req, res) => {
  if (!ensureGfsReady(res)) return;
  try {
    const { ObjectId } = mongoose.Types;
    const _id = new ObjectId(req.params.id);
    const file = await gfsBucket.find({ _id }).toArray();
    if (!file || file.length === 0) return res.status(404).json({ error: "Not found" });

    res.set("Content-Type", file[0].contentType || "application/octet-stream");
    gfsBucket.openDownloadStream(_id).pipe(res);
  } catch (err) {
    res.status(400).json({ error: "Invalid id" });
  }
});

app.delete("/files/:id", async (req, res) => {
  if (!ensureGfsReady(res)) return;
  try {
    const { ObjectId } = mongoose.Types;
    await gfsBucket.delete(new ObjectId(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Start ----------
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
