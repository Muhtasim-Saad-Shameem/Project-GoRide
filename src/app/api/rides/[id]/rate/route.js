import connectMongoDB from "@/lib/mongodb";
import Ride from "@/models/Ride";
import User from "@/models/User";
import ReviewLog from "@/models/ReviewLog";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const FRAUD_REPEAT_THRESHOLD = 3;

const getJwtSecretKey = () => {
  const secret =
    process.env.JWT_SECRET ||
    "fallback_default_secret_please_change_in_production";
  return new TextEncoder().encode(secret);
};

export async function POST(request, { params }) {
  await connectMongoDB();

  try {
    const { id } = await params;
    const { rating, review, role } = await request.json(); // role: 'rider' or 'driver'
    const numericRating = Number(rating);

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return NextResponse.json(
        { success: false, error: "Invalid rating" },
        { status: 400 },
      );
    }

    if (review !== undefined && typeof review !== "string") {
      return NextResponse.json(
        { success: false, error: "Invalid review" },
        { status: 400 },
      );
    }

    if (!String(review || "").trim()) {
      return NextResponse.json(
        { success: false, error: "Review feedback is required" },
        { status: 400 },
      );
    }

    if (role !== "rider" && role !== "driver") {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    // Authenticate user
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    let userId;
    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());
      userId = payload.userId;
    } catch (err) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 },
      );
    }

    // Find the ride
    const ride = await Ride.findById(id);
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found" },
        { status: 404 },
      );
    }

    if (ride.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "You can only rate completed rides" },
        { status: 400 },
      );
    }

    // Block already-flagged users from submitting ratings.
    const reviewer = await User.findById(userId);
    if (reviewer?.isFlagged) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account is flagged for fraudulent reviews.",
        },
        { status: 403 },
      );
    }

    const isPassenger = Array.isArray(ride.passengers)
      ? ride.passengers.some(
          (p) => (p?._id || p)?.toString() === userId,
        )
      : false;
    const isDriver =
      (ride.creator && ride.creator.toString() === userId) ||
      (ride.driverId && ride.driverId.toString() === userId);
    const hasExplicitDriverIdentity = Boolean(ride.creator || ride.driverId);
    const isLegacyDriverFallback = !hasExplicitDriverIdentity && !isPassenger;

    // Fraud Detection Logic
    // Check recent ratings actually submitted by this user via review logs.
    const previousLogs = await ReviewLog.find({
      userId,
      action: "RATING_SUBMITTED",
      rating: { $gte: 1, $lte: 5 },
    })
      .sort({ createdAt: -1 })
      .limit(FRAUD_REPEAT_THRESHOLD - 1)
      .select("rating");

    const previousRatings = previousLogs.map((entry) => entry.rating);
    const repeatedPattern =
      previousRatings.length === FRAUD_REPEAT_THRESHOLD - 1 &&
      previousRatings.every((value) => value === numericRating);

    if (repeatedPattern) {
      await User.findByIdAndUpdate(userId, {
        trustScore: 0,
        isFlagged: true,
      });

      await ReviewLog.create({
        userId,
        action: "FRAUD_DETECTED",
        details: `Repeated identical ratings detected (${FRAUD_REPEAT_THRESHOLD} times in a row).`,
        rating: numericRating,
        rideId: ride._id,
        role,
        isFraudulent: true,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Fraudulent activity detected. Your Trust Score has been reset.",
        },
        { status: 400 },
      );
    }

    let targetUserId;
    if (role === "rider") {
      // User is rating the driver
      if (!isPassenger) {
        return NextResponse.json(
          { success: false, error: "You were not a passenger on this ride" },
          { status: 403 },
        );
      }
      if (ride.driverRating) {
        return NextResponse.json(
          { success: false, error: "You have already rated this driver" },
          { status: 400 },
        );
      }
      ride.driverRating = numericRating;
      ride.driverReview = (review || "").trim();
      ride.driverId = ride.creator;
      targetUserId = ride.creator;
    } else if (role === "driver") {
      // User is rating the rider
      if (!isDriver && !isLegacyDriverFallback) {
        return NextResponse.json(
          { success: false, error: "You were not the driver for this ride" },
          { status: 403 },
        );
      }
      if (ride.riderRating) {
        return NextResponse.json(
          { success: false, error: "You have already rated this rider" },
          { status: 400 },
        );
      }
      if (!ride.passengers?.length) {
        return NextResponse.json(
          { success: false, error: "No rider found for this ride" },
          { status: 400 },
        );
      }
      // Keep existing behavior: first passenger is the rated rider.
      targetUserId = ride.riderId || ride.passengers[0];
      ride.riderRating = numericRating;
      ride.riderReview = (review || "").trim();
      ride.riderId = targetUserId;
    }

    // Compatibility fields requested for rating/review payload on Ride.
    ride.rating = numericRating;
    ride.review = (review || "").trim();

    await ride.save();

    await ReviewLog.create({
      userId,
      targetUserId,
      rideId: ride._id,
      action: "RATING_SUBMITTED",
      details: `${role} submitted a rating for this ride.`,
      role,
      rating: numericRating,
    });

    // Update Trust Score for rated user based on all ratings they have received.
    if (targetUserId) {
      const targetIdString = targetUserId.toString();

      const receivedRides =
        role === "rider"
          ? await Ride.find({
              creator: targetIdString,
              driverRating: { $gte: 1, $lte: 5 },
            }).select("driverRating")
          : await Ride.find({
              passengers: targetIdString,
              riderRating: { $gte: 1, $lte: 5 },
            }).select("riderRating");

      const ratingValues =
        role === "rider"
          ? receivedRides.map((entry) => entry.driverRating)
          : receivedRides.map((entry) => entry.riderRating);

      const totalRatings = ratingValues.length;
      const average = totalRatings
        ? ratingValues.reduce((sum, value) => sum + value, 0) / totalRatings
        : 5.0;

      const roundedAverage = Math.round(average * 10) / 10;

      await User.findByIdAndUpdate(targetUserId, {
        trustScore: roundedAverage,
        totalRatings,
      });

      ride.trustScore = roundedAverage;
      await ride.save();

    }

    return NextResponse.json(
      {
        success: true,
        message: "Rating submitted successfully",
        data: ride,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Rating error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
