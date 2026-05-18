const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingReminder = sequelize.define(
    'BookingReminder',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      leadId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'lead_id' },
      bookingUid: { type: DataTypes.STRING(255), allowNull: true, field: 'booking_uid' },
      bookingStart: { type: DataTypes.DATE, allowNull: false, field: 'booking_start' },
      // When the queue should fire this reminder. Computed as bookingStart - 2h, or "now"
      // (i.e. createdAt) if the booking is < 2h away so the queue sends ASAP.
      dueAt: { type: DataTypes.DATE, allowNull: false, field: 'due_at' },
      timezone: { type: DataTypes.STRING(64), allowNull: true },
      meetingUrl: { type: DataTypes.STRING(1024), allowNull: true, field: 'meeting_url' },
      // Snapshot of the cal.com booking response, in case we need fields we didn't break out.
      bookingSnapshot: { type: DataTypes.JSON, allowNull: true, field: 'booking_snapshot' },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      sentAt: { type: DataTypes.DATE, allowNull: true, field: 'sent_at' },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      tableName: 'booking_reminders',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_booking_reminders_status', fields: ['status'] },
        { name: 'idx_booking_reminders_due_at', fields: ['due_at'] },
        { name: 'idx_booking_reminders_lead', fields: ['lead_id'] },
      ],
    }
  );

  return BookingReminder;
};
