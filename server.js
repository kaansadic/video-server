const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed'));
    }
  }
});

const videos = new Map();

app.post('/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const expiresAt = Date.now() + (30 * 60 * 1000);

    videos.set(videoId, {
      data: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      size: req.file.size,
      expiresAt: expiresAt,
      createdAt: Date.now()
    });

    setTimeout(() => {
      if (videos.has(videoId)) {
        videos.delete(videoId);
        console.log(`Deleted expired video: ${videoId}`);
      }
    }, 30 * 60 * 1000);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const videoUrl = `${baseUrl}/video/${videoId}`;

    res.json({
      success: true,
      video_url: videoUrl,
      video_id: videoId,
      expires_at: new Date(expiresAt).toISOString(),
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/video/:id', (req, res) => {
  const videoId = req.params.id;
  const video = videos.get(videoId);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (Date.now() > video.expiresAt) {
    videos.delete(videoId);
    return res.status(404).json({ error: 'Video expired' });
  }

  res.set({
    'Content-Type': video.mimeType,
    'Content-Length': video.data.length,
    'Content-Disposition': `inline; filename="${video.fileName}"`,
    'Cache-Control': 'public, max-age=1800',
    'Access-Control-Allow-Origin': '*'
  });

  res.send(video.data);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    videos_count: videos.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video server running on port ${PORT}`);
});
