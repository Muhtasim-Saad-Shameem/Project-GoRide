import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    origin: {
      type: String,
      required: [true, 'Please add an origin'],
      trim: true,
    },
    destination: {
      type: String,
      required: [true, 'Please add a destination'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Please add a date'],
    },
    time: {
      type: String,
      required: [true, 'Please add a time'],
    },
    seats: {
      type: Number,
      required: [true, 'Please add number of seats'],
      min: 1,
      max: 8,
    },
    fare: {
      type: Number,
      required: [true, 'Please add fare'],
      min: 0,
    },
    vehicleType: {
      type: String,
      enum: ['Car', 'Motorcycle', 'Bus', 'Van', 'Micro', 'Bike'],
      required: [true, 'Please add vehicle type'],
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Please add vehicle number'],
      trim: true,
    },
    driverName: {
      type: String,
      required: [true, 'Please add driver name'],
      trim: true,
    },
    driverPhone: {
      type: String,
      required: [true, 'Please add driver phone'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    preferences: {
      type: [String],
      default: [],
    },
    distanceKm: {
      type: Number,
    },
    duration: {
      type: String,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Make it optional for backwards compatibility
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    passengers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    department: {
      type: String,
      trim: true,
      default: '',
    },
    buildingName: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      // waiting → active → en-route → arrived → completed
      enum: ['waiting', 'active', 'en-route', 'arrived', 'completed', 'cancelled'],
      default: 'active',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'unpaid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bKash', 'nagad', 'rocket', 'online', 'none'],
      default: 'none',
    },
    riderRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    riderReview: {
      type: String,
      trim: true,
    },
    driverRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    driverReview: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Ride || mongoose.model('Ride', rideSchema);
