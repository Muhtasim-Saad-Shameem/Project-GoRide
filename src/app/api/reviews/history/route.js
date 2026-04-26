import connectMongoDB from "@/lib/mongodb";
import Ride from "@/models/Ride";
import ReviewLog from "@/models/ReviewLog";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const getJwtSecretKey = () => {
  const secret =
    process.env.JWT_SECRET ||
    "fallback_default_secret_please_change_in_production";
  return new TextEncoder().encode(secret);
};

export async function GET(request) {
  await connectMongoDB();

  try {
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

    const logs = await ReviewLog.find({
      action: "RATING_SUBMITTED",
      $or: [{ userId }, { targetUserId: userId }],
    })
      .populate("rideId", "origin destination date riderReview driverReview")
      .populate("userId", "name email")
      .populate("targetUserId", "name email")
      .sort({ createdAt: -1 });

    const historyFromLogs = logs.map((entry) => {
      const direction =
        entry.userId?._id?.toString() === userId ? "given" : "received";

      const reviewText =
        direction === "given"
          ? entry.role === "driver"
            ? entry.rideId?.riderReview || ""
            : entry.rideId?.driverReview || ""
          : entry.role === "driver"
            ? entry.rideId?.riderReview || ""
            : entry.rideId?.driverReview || "";

      return {
        _id: entry._id,
        source: "log",
        direction,
        createdAt: entry.createdAt,
        role: entry.role,
        rating: entry.rating,
        review: reviewText,
        ride: entry.rideId
          ? {
              _id: entry.rideId._id,
              date: entry.rideId.date,
              origin: entry.rideId.origin,
              destination: entry.rideId.destination,
            }
          : null,
        reviewer: entry.userId
          ? {
              _id: entry.userId._id,
              name: entry.userId.name,
              email: entry.userId.email,
            }
          : null,
        targetUser: entry.targetUserId
          ? {
              _id: entry.targetUserId._id,
              name: entry.targetUserId.name,
              email: entry.targetUserId.email,
            }
          : null,
      };
    });

    const loggedRideIds = new Set(
      historyFromLogs
        .map((entry) => entry.ride?._id?.toString())
        .filter(Boolean),
    );

    const legacyRides = await Ride.find({
      $or: [
        { creator: userId, riderRating: { $gte: 1, $lte: 5 } },
        { passengers: userId, driverRating: { $gte: 1, $lte: 5 } },
      ],
    })
      .populate("creator", "name email")
      .populate("passengers", "name email")
      .sort({ updatedAt: -1 });

    const historyFromLegacyRides = legacyRides
      .filter((ride) => !loggedRideIds.has(ride._id.toString()))
      .map((ride) => {
        const isCreator = ride.creator?._id?.toString() === userId;
        const role = isCreator ? "driver" : "rider";

        return {
          _id: `legacy-${ride._id}`,
          source: "ride",
          direction: "given",
          createdAt: ride.updatedAt || ride.createdAt,
          role,
          rating: isCreator ? ride.riderRating : ride.driverRating,
          review: isCreator ? ride.riderReview : ride.driverReview,
          ride: {
            _id: ride._id,
            date: ride.date,
            origin: ride.origin,
            destination: ride.destination,
          },
          reviewer: isCreator
            ? {
                _id: ride.creator?._id,
                name: ride.creator?.name || "Driver",
                email: ride.creator?.email || "",
              }
            : {
                _id: userId,
                name: "You",
                email: "",
              },
          targetUser: isCreator
            ? {
                _id: ride.passengers?.[0]?._id,
                name: ride.passengers?.[0]?.name || "Passenger",
                email: ride.passengers?.[0]?.email || "",
              }
            : {
                _id: ride.creator?._id,
                name: ride.creator?.name || "Driver",
                email: ride.creator?.email || "",
              },
        };
      });

    const history = [...historyFromLogs, ...historyFromLegacyRides].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    return NextResponse.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error("Review history error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
