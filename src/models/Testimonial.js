const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Testimonial = sequelize.define(
    'Testimonial',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      quote: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
      author: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: true } },
      title: { type: DataTypes.STRING(255), allowNull: true },
      company: { type: DataTypes.STRING(255), allowNull: true },
      industry: { type: DataTypes.STRING(255), allowNull: true },
      rating: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 5,
        validate: { min: 1, max: 5 },
      },
      photo: { type: DataTypes.STRING(500), allowNull: true },
      photoPublicId: { type: DataTypes.STRING(500), allowNull: true, field: 'photo_public_id' },
      videoUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'video_url' },
      videoPublicId: { type: DataTypes.STRING(500), allowNull: true, field: 'video_public_id' },
      thumbnailUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'thumbnail_url' },
      resultsBadge: { type: DataTypes.STRING(100), allowNull: true, field: 'results_badge' },
      status: {
        type: DataTypes.ENUM('draft', 'published'),
        allowNull: false,
        defaultValue: 'draft',
      },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    },
    {
      tableName: 'testimonials',
      timestamps: true,
      underscored: true,
      indexes: [{ name: 'idx_testimonials_status_sort', fields: ['status', 'sort_order'] }],
      validate: {
        photoPaired() {
          const a = !!this.photo;
          const b = !!this.photoPublicId;
          if (a !== b) throw new Error('photo and photoPublicId must both be set or both null');
        },
        videoTriple() {
          const a = !!this.videoUrl;
          const b = !!this.videoPublicId;
          const c = !!this.thumbnailUrl;
          if (!(a === b && b === c)) {
            throw new Error('videoUrl, videoPublicId, and thumbnailUrl must all be set or all null');
          }
        },
      },
    }
  );

  return Testimonial;
};
