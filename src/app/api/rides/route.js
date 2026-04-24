import connectMongoDB from "@/lib/mongodb";
import Ride from "@/models/Ride";
import User from "@/models/User";
import DriverDoc from "@/models/DriverDoc";
import admin from "@/lib/firebase";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const getJwtSecretKey = () => {
  const secret =
    process.env.JWT_SECRET ||
    "fallback_default_secret_please_change_in_production";
  return new TextEncoder().encode(secret);
};

const sendRidePostedNotification = async (userId) => {
  try {
    await connectMongoDB();
    const user = await User.findById(userId);
    if (!user?.fcmToken) return;

    const message = {
      notification: {
        title: "Rider is on the way",
        body: "A rider is on his way and will arrive at your location within 10-12 minutes.",
      },
      token: user.fcmToken,
    };

    await admin.messaging().send(message);
  } catch (error) {
    console.error("Ride posted notification error:", error);
  }
};

export async function GET(request) {
  try {
    await connectMongoDB();

    const searchParams =
      request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const department = searchParams.get("department");
    const building = searchParams.get("building");
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const date = searchParams.get("date");
    const vehicleType = searchParams.get("vehicleType");
    const status = searchParams.get("status");

    const query = {};

    if (department) query.department = department;
    if (building) query.buildingName = building;
    if (vehicleType) query.vehicleType = vehicleType;
    if (status) query.status = status;

    if (origin) query.origin = { $regex: origin.trim(), $options: "i" };
    if (destination)
      query.destination = { $regex: destination.trim(), $options: "i" };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const rides = await Ride.find(query)
      .populate("creator", "name department phone email")
      .sort({ createdAt: -1 });

    // Get unique creator emails
    const creatorEmails = [
      ...new Set(rides.map((ride) => ride.creator?.email).filter(Boolean)),
    ];

    // Check which creators have approved driver docs
    const approvedDocs = await DriverDoc.find({
      email: { $in: creatorEmails },
      status: "approved",
    }).select("email");

    const approvedEmails = new Set(approvedDocs.map((doc) => doc.email));

    // Add hasApprovedDocs to each ride
    const ridesWithDocs = rides.map((ride) => ({
      ...ride.toObject(),
      hasApprovedDocs: approvedEmails.has(ride.creator?.email),
    }));

    return Response.json(
      {
        success: true,
        data: ridesWithDocs,
        total: ridesWithDocs.length,
      },
      { status: 200 },
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

export async function POST(request) {
  try {
    await connectMongoDB();
    const body = await request.json();

    // Map form data to Ride schema
    const {
      origin,
      destination,
      date,
      availableSeats,
      startTime,
      endTime,
      vehicleType,
      preferences,
      fare,
      distanceKm,
      duration,
      department,
      buildingName,
    } = body;

    // Validate required fields
    if (
      !origin ||
      !destination ||
      !date ||
      !availableSeats ||
      !startTime ||
      !endTime ||
      !vehicleType
    ) {
      return Response.json(
        {
          success: false,
          error: "Please fill in all required fields",
        },
        { status: 400 },
      );
    }

    // Create time string from startTime and endTime
    const timeString = `${startTime} - ${endTime}`;

    // Create ride object with form data
    const rideData = {
      origin: origin.trim(),
      destination: destination.trim(),
      date: new Date(date),
      time: timeString,
      seats: parseInt(availableSeats),
      vehicleType: vehicleType,
      vehicleNumber: "TBD", // To be updated by user
      driverName: "TBD", // To be updated by user
      driverPhone: "TBD", // To be updated by user
      fare: fare ? parseInt(fare) : 0,
      description: "",
      status: "active",
      preferences: Array.isArray(preferences) ? preferences : [],
      ...(distanceKm && { distanceKm: parseFloat(distanceKm) }),
      ...(duration && { duration }),
      department: department || "",
      buildingName: buildingName || "",
    };

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        if (payload.userId) {
          rideData.creator = payload.userId;
        }
      } catch (err) {
        console.error("Token verification failed in POST /api/rides", err);
      }
    }

    const ride = await Ride.create(rideData);

    if (rideData.creator) {
      setTimeout(() => {
        sendRidePostedNotification(rideData.creator).catch((err) => {
          console.error("Scheduled ride notification failed:", err);
        });
      }, 60000);
    }

    // Calculate and award impact points
    if (rideData.creator && rideData.distanceKm && rideData.seats) {
      const distance = rideData.distanceKm;
      const passengers = rideData.seats;
      const emission_solo = distance * 150 * passengers;
      const emission_shared = (distance * 150) / passengers;
      const reduced_emission = emission_solo - emission_shared;
      const points = Math.floor(reduced_emission / 150);

      if (points > 0) {
        await User.findByIdAndUpdate(rideData.creator, {
          $inc: { impactPoints: points },
        });
      }
    }

    return Response.json(
      {
        success: true,
        message: "Ride offered successfully!",
        data: ride,
      },
      { status: 201 },
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
