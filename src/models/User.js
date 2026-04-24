import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      trim: true,
      lowercase: true,
      unique: true,
    },
    studentId: {
      type: String,
      required: [true, "Please add a student ID"],
      unique: true,
    },
    sex: {
      type: String,
      required: true,
      enum: ["male", "female", "other"], // Add based on app needs
    },
    department: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: false,
      select: false, // Never returned in queries
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    impactPoints: {
      type: Number,
      default: 0,
    },
    trustScore: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index only (email/studentId use unique: true auto-index)
userSchema.index({ role: 1, isFlagged: 1 });

export default mongoose.models.User || mongoose.model("User", userSchema);
