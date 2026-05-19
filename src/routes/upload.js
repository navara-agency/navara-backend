const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { cloudinary, makeStorage, ALLOWED_FORMATS } = require('../config/cloudinary');

const router = express.Router();

const VALID_TYPES = ['image', 'video', 'logo', 'attachment'];

// Per-type size caps. Attachments are capped tightly because SMTP servers (including
// Hostinger) reject large messages — anything over ~10 MB risks silent bounces.
const SIZE_LIMITS = {
  image: 100 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  logo: 100 * 1024 * 1024,
  attachment: 10 * 1024 * 1024,
};

function uploaderFor(type) {
  return multer({ storage: makeStorage(type), limits: { fileSize: SIZE_LIMITS[type] || 100 * 1024 * 1024 } });
}

function ext(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

router.post('/', requireAuth, (req, res, next) => {
  const type = String(req.query.type || '');
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type must be one of: image, video, logo' });
  }

  const handler = uploaderFor(type).single('file');
  handler(req, res, (err) => {
    if (err) {
      const status = err.message?.includes('File type') ? 400 : 500;
      return res.status(status).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const e = ext(req.file.originalname);
    if (!ALLOWED_FORMATS[type].includes(e)) {
      // best-effort cleanup if cloudinary did accept
      if (req.file.filename) {
        cloudinary.uploader.destroy(req.file.filename).catch(() => {});
      }
      return res.status(400).json({ error: `Disallowed file type for ${type}: .${e}` });
    }

    const url = req.file.path || req.file.secure_url;
    const publicId = req.file.filename || req.file.public_id;
    const out = {
      url,
      publicId,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
    };

    if (type === 'video') {
      // Cloudinary auto-generated thumbnail: replace video extension with .jpg
      out.thumbnailUrl = url.replace(/\.[^.]+$/, '.jpg');
    }

    return res.json(out);
  });
});

module.exports = router;
