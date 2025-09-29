// // server.js
// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const path = require('path');
// const { GridFsStorage } = require('multer-gridfs-storage');
// const multer = require('multer');
// const { GridFSBucket } = require('mongodb');

// const app = express();
// app.use(cors());
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

// // Change this if you use Atlas:
// const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/filedb';

// // Connect
// mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.error(err));

// const conn = mongoose.connection;
// let gfsBucket;
// conn.once('open', () => {
//   gfsBucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
//   console.log('GridFSBucket ready');
// });

// // Multer storage for GridFS
// const storage = new GridFsStorage({
//   url: mongoURI,
//   options: { useNewUrlParser: true, useUnifiedTopology: true },
//   file: (req, file) => {
//     return {
//       filename: Date.now() + '_' + file.originalname, // unique name
//       bucketName: 'uploads',
//       metadata: { originalname: file.originalname },
//       contentType: file.mimetype
//     };
//   }
// });
// const upload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
// });

// // Upload endpoint
// app.post('/upload', upload.single('file'), (req, res) => {
//   // req.file contains upload info; convert id to string for the frontend
//   const file = req.file;
//   res.json({
//     file: {
//       id: file.id.toString(),
//       filename: file.filename,
//       originalname: file.metadata?.originalname,
//       contentType: file.contentType
//     }
//   });
// });

// // List files (returns array of simple objects)
// app.get('/files', async (req, res) => {
//   try {
//     const files = await conn.db.collection('uploads.files').find().sort({ uploadDate: -1 }).toArray();
//     const out = files.map(f => ({
//       _id: f._id.toString(),
//       filename: f.filename,
//       originalname: f.metadata?.originalname || f.filename,
//       length: f.length,
//       contentType: f.contentType,
//       uploadDate: f.uploadDate
//     }));
//     res.json(out);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // View / Download file by id
// app.get('/files/:id', async (req, res) => {
//   try {
//     const id = new mongoose.Types.ObjectId(req.params.id);
//     const filesColl = conn.db.collection('uploads.files');
//     const fileDoc = await filesColl.findOne({ _id: id });
//     if (!fileDoc) return res.status(404).send('File not found');

//     // Set headers so browser may preview (images, pdf) or download
//     res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
//     // use inline to preview if possible; change to attachment to force download
//     res.set('Content-Disposition', `inline; filename="${fileDoc.filename}"`);

//     const downloadStream = gfsBucket.openDownloadStream(id);
//     downloadStream.on('error', () => res.status(500).end());
//     downloadStream.pipe(res);
//   } catch (err) {
//     res.status(400).json({ error: 'Invalid id or server error' });
//   }
// });

// // Delete file by id
// app.delete('/files/:id', async (req, res) => {
//   try {
//     const id = new mongoose.Types.ObjectId(req.params.id);
//     await gfsBucket.delete(id); // will throw if not found
//     res.json({ success: true });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// // Start server
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));


// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { GridFsStorage } = require('multer-gridfs-storage');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB URI
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/filedb';

// Connect
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const conn = mongoose.connection;
let gfsBucket;
conn.once('open', () => {
  gfsBucket = new GridFSBucket(conn.db, { bucketName: 'uploads' });
  console.log('GridFSBucket ready');
});

// Multer storage with GridFS
const storage = new GridFsStorage({
  url: mongoURI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => ({
    filename: Date.now() + '_' + file.originalname,
    bucketName: 'uploads',
    metadata: { originalname: file.originalname },
    contentType: file.mimetype
  })
});

// Add 10MB limit and proper error handling
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Upload endpoint with safe error handling
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Send file info safely
    const file = req.file;
    res.json({
      file: {
        id: file.id?.toString() || null,
        filename: file.filename,
        originalname: file.metadata?.originalname,
        contentType: file.contentType
      }
    });
  });
});

// List files
app.get('/files', async (req, res) => {
  try {
    const files = await conn.db.collection('uploads.files')
      .find().sort({ uploadDate: -1 }).toArray();
    const out = files.map(f => ({
      _id: f._id.toString(),
      filename: f.filename,
      originalname: f.metadata?.originalname || f.filename,
      length: f.length,
      contentType: f.contentType,
      uploadDate: f.uploadDate
    }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View / download file
app.get('/files/:id', async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const fileDoc = await conn.db.collection('uploads.files').findOne({ _id: id });
    if (!fileDoc) return res.status(404).send('File not found');

    res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${fileDoc.filename}"`);

    const downloadStream = gfsBucket.openDownloadStream(id);
    downloadStream.on('error', (err) => {
      console.error('Download error:', err);
      res.status(500).end();
    });
    downloadStream.pipe(res);
  } catch (err) {
    res.status(400).json({ error: 'Invalid ID or server error' });
  }
});

// Delete file
app.delete('/files/:id', async (req, res) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    await gfsBucket.delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

