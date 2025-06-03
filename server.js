const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use('/uploads', express.static('uploads'));

let posts = [];

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname;
    cb(null, name);
  }
});
const upload = multer({ storage });

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.post('/api/post', upload.single('image'), (req, res) => {
  const { caption, anon_id, lat, lng } = req.body;
  const imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  const id = `${Date.now()}-${anon_id}`;
  const timestamp = Date.now();

  const post = {
    id,
    caption,
    anon_id,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    imageUrl,
    timestamp,
    likes: 0,
    likedBy: [],
  };

  posts.push(post);

  // Auto-delete after 4 hours
  setTimeout(() => {
    posts = posts.filter(p => p.id !== post.id);
    fs.unlink(path.join(__dirname, 'uploads', req.file.filename), () => {});
  }, 4 * 60 * 60 * 1000);

  res.json({ success: true, post });
});

app.get('/api/posts', (req, res) => {
  const { lat, lng, radius = 2 } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const now = Date.now();

  posts = posts.filter(p => now - p.timestamp < 4 * 60 * 60 * 1000);

  const nearby = posts.filter(p => {
    const d = getDistanceInMiles(userLat, userLng, p.lat, p.lng);
    return d <= parseFloat(radius);
  });

  res.json(nearby);
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
