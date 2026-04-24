import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongodb";
import Message from "@/models/Message";

export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const rideId = searchParams.get("rideId");
    const since = searchParams.get("since");

    if (!rideId) {
      return NextResponse.json(
        { success: false, error: "rideId is required" },
        { status: 400 },
      );
    }

    const query = { rideId };
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(100);
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const { rideId, senderName, senderRole, content } = body;

    if (!rideId || !senderName || !content) {
      return NextResponse.json(
        {
          success: false,
          error: "rideId, senderName, and content are required",
        },
        { status: 400 },
      );
    }

    const message = await Message.create({
      rideId,
      senderName: senderName.trim(),
      senderRole: senderRole || "rider",
      content: content.trim(),
    });

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
