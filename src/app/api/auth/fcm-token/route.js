import connectMongoDB from "@/lib/mongodb";
import User from "@/models/User";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

const getJwtSecretKey = () => {
  const secret =
    process.env.JWT_SECRET ||
    "fallback_default_secret_please_change_in_production";
  return new TextEncoder().encode(secret);
};

export async function POST(request) {
  await connectMongoDB();

  try {
    const { fcmToken } = await request.json();

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

    // Update user's FCM token
    await User.findByIdAndUpdate(userId, { fcmToken });

    return NextResponse.json(
      { success: true, message: "FCM token updated" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update FCM token error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}