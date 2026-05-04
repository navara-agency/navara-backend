const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDERS = {
  image: 'navara/images',
  video: 'navara/videos',
  logo: 'navara/logos',
};

const ALLOWED_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
  logo: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
};

function makeStorage(type) {
  const folder = FOLDERS[type];
  if (!folder) throw new Error(`Unknown upload type: ${type}`);
  return new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => ({
      folder,
      resource_type: type === 'video' ? 'video' : 'image',
      allowed_formats: ALLOWED_FORMATS[type],
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_')}`,
    }),
  });
}

module.exports = { cloudinary, makeStorage, ALLOWED_FORMATS, FOLDERS };
