const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

let posts = [];

// Venue list
const venues = [
  { id: 'joycehouse', name: '587 Joyce Drive', lat: 34.150827, lng: -119.191937 },
  { id: 'mirage', name: 'Mirage Lounge', lat: 34.12345, lng: -119.12345 },
  { id: 'echo', name: 'Echo Club', lat: 34.12412, lng: -119.12412 }
];

// Distance helper
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

// File storage
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname;
    cb(null, name);
  }
});
const upload = multer({ storage });

// Post a new vibe
app.post('/api/post', upload.single('image'), (req, res) => {
  const { caption, anon_id, lat, lng, nickname } = req.body;
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const id = `${Date.now()}-${anon_id}`;
  const timestamp = Date.now();

  const post = {
    id,
    caption,
    anon_id,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    nickname: nickname || 'Anonymous',
    imageUrl,
    timestamp,
    likes: 0,
    likedBy: []
  };

  posts.push(post);

  // Auto-expire after 4 hours
  setTimeout(() => {
    posts = posts.filter(p => p.id !== post.id);
    fs.unlink(path.join(__dirname, 'uploads', req.file.filename), () => {});
  }, 4 * 60 * 60 * 1000);

  res.json({ success: true, post });
});

// Get nearby posts
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

// Like a post
app.post('/api/like/:id', (req, res) => {
  const { anon_id } = req.body;
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.likedBy.includes(anon_id)) return res.status(400).json({ error: 'Already liked' });

  post.likes += 1;
  post.likedBy.push(anon_id);
  res.json({ success: true, likes: post.likes });
});

// Get venue list with vibeScore
app.get('/api/venues', (req, res) => {
  const now = Date.now();
  const scored = venues.map(venue => {
    const nearbyPosts = posts.filter(p => {
      const d = getDistanceInMiles(venue.lat, venue.lng, p.lat, p.lng);
      return d <= 0.06 && now - p.timestamp < 4 * 60 * 60 * 1000;
    });

    const vibeScore = nearbyPosts.length * 2;
    return { ...venue, vibeScore };
  });

  res.json(scored);
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
