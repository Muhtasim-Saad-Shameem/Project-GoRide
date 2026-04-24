import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongodb";
import DriverDoc from "@/models/DriverDoc";

export async function GET(req) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    const query = {};
    if (email) query.email = email;

    const docs = await DriverDoc.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: docs });
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
    const data = await req.formData();

    const driverName = data.get("driverName");
    const email = data.get("email");
    const phone = data.get("phone");
    const vehicleNumber = data.get("vehicleNumber");
    const vehicleType = data.get("vehicleType");
    const licenseFile = data.get("license");
    const registrationFile = data.get("registration");
    const notes = data.get("notes") || "";

    if (
      !driverName ||
      !email ||
      !phone ||
      !vehicleNumber ||
      !vehicleType ||
      !licenseFile ||
      !registrationFile
    ) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 },
      );
    }

    const doc = await DriverDoc.create({
      driverName,
      email,
      phone,
      vehicleNumber,
      vehicleType,
      licenseFileName: `license_${Date.now()}_${licenseFile.name}`,
      licenseOriginalName: licenseFile.name,
      registrationFileName: `reg_${Date.now()}_${registrationFile.name}`,
      registrationOriginalName: registrationFile.name,
      notes,
      status: "pending",
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
