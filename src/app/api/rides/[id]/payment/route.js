import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import connectMongoDB from "@/lib/mongodb";
import Ride from "@/models/Ride";

const ONLINE_METHODS = new Set(["bkash", "nagad", "rocket"]);

const getJwtSecretKey = () => {
  const secret =
    process.env.JWT_SECRET ||
    "fallback_default_secret_please_change_in_production";
  return new TextEncoder().encode(secret);
};

async function getCurrentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload?.userId ? String(payload.userId) : null;
  } catch {
    return null;
  }
}

function isPassengerForRide(ride, userId) {
  if (!userId) return false;

  if (ride.riderId && String(ride.riderId) === userId) {
    return true;
  }

  return Array.isArray(ride.passengers)
    ? ride.passengers.some((p) => String(p?._id || p) === userId)
    : false;
}

function isDriverForRide(ride, userId) {
  if (!userId) return false;

  const creatorId = String(ride.creator?._id || ride.creator || "");
  const driverId = String(ride.driverId || "");

  return creatorId === userId || driverId === userId;
}

function hasExplicitDriverIdentity(ride) {
  return Boolean(ride.creator?._id || ride.creator || ride.driverId);
}

export async function PUT(request, { params }) {
  await connectMongoDB();

  try {
    const { id } = await params;
    const body = await request.json();
    const action = body?.action;
    const method = String(body?.method || "").toLowerCase();

    const ride = await Ride.findById(id).populate("creator", "_id");

    if (!ride) {
      return Response.json(
        {
          success: false,
          error: "Ride not found",
        },
        { status: 404 },
      );
    }

    if (ride.status !== "completed") {
      return Response.json(
        {
          success: false,
          error: "Payment can only be processed after the ride is completed",
        },
        { status: 400 },
      );
    }

    const userId = await getCurrentUserId();
    const isPassenger = isPassengerForRide(ride, userId);
    const isDriver = isDriverForRide(ride, userId);
    const isLegacyDriverFallback =
      !hasExplicitDriverIdentity(ride) && Boolean(userId) && !isPassenger;

    if (action === "cash-intent") {
      if (!isPassenger) {
        return Response.json(
          {
            success: false,
            error: "Only a passenger can request cash payment",
          },
          { status: 403 },
        );
      }

      if (ride.paymentStatus === "paid") {
        return Response.json(
          {
            success: false,
            error: "This ride is already paid",
          },
          { status: 400 },
        );
      }

      ride.paymentStatus = "pending";
      ride.paymentMethod = "cash";
      await ride.save();

      return Response.json(
        {
          success: true,
          message: "Cash payment marked as pending. Driver confirmation required.",
          data: ride,
        },
        { status: 200 },
      );
    }

    if (action === "driver-confirm-cash") {
      if (ride.paymentMethod !== "cash") {
        return Response.json(
          {
            success: false,
            error: "Cash confirmation is only allowed for cash payments",
          },
          { status: 400 },
        );
      }

      ride.paymentStatus = "paid";
      ride.paymentMethod = "cash";
      await ride.save();

      return Response.json(
        {
          success: true,
          message: "Cash payment confirmed",
          data: ride,
        },
        { status: 200 },
      );
    }

    if (action === "online-pay") {
      if (!isPassenger) {
        return Response.json(
          {
            success: false,
            error: "Only a passenger can make online payment",
          },
          { status: 403 },
        );
      }

      if (!ONLINE_METHODS.has(method)) {
        return Response.json(
          {
            success: false,
            error: "Invalid online payment method",
          },
          { status: 400 },
        );
      }

      ride.paymentStatus = "paid";
      ride.paymentMethod = method;
      await ride.save();

      return Response.json(
        {
          success: true,
          message: "Online payment successful",
          data: ride,
        },
        { status: 200 },
      );
    }

    return Response.json(
      {
        success: false,
        error: "Invalid payment action",
      },
      { status: 400 },
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 },
    );
  }
}
