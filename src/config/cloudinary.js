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
  attachment: 'navara/attachments',
};

const ALLOWED_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
  logo: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  // Attachments cover the common business doc set. Cloudinary stores these as 'raw'.
  attachment: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'jpg', 'jpeg', 'png'],
};

// Cloudinary needs to know the resource type up front. Videos go to 'video'; documents
// to 'raw'; everything else to 'image' (Cloudinary's default for static media).
function resourceTypeFor(uploadType) {
  if (uploadType === 'video') return 'video';
  if (uploadType === 'attachment') return 'raw';
  return 'image';
}

function makeStorage(type) {
  const folder = FOLDERS[type];
  if (!folder) throw new Error(`Unknown upload type: ${type}`);
  return new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => ({
      folder,
      resource_type: resourceTypeFor(type),
      allowed_formats: ALLOWED_FORMATS[type],
      // Preserve the original filename in the public_id so admins recognise their files
      // in Cloudinary's media library (and so the email "downloaded as" name is sensible).
      public_id: `${Date.now()}-${file.originalname.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_')}`,
    }),
  });
}

module.exports = { cloudinary, makeStorage, ALLOWED_FORMATS, FOLDERS };
