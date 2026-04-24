"use client";

import Header from "@/components/Header";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PreferencesModal from "@/components/PreferencesModal";
import { nameToOption } from "@/lib/preferenceOptions";
import { io } from "socket.io-client";

let socketInstance = null;
function getSocket() {
  if (!socketInstance) {
    socketInstance = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
  }
  return socketInstance;
}

// Status flow: waiting → active → en-route → arrived → completed
const STATUS_FLOW = {
  waiting: {
    next: "active",
    label: "▶ Start Accepting",
    color: "bg-green-600 hover:bg-green-700",
  },
  active: {
    next: "en-route",
    label: "🚗 Start Ride",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  "en-route": {
    next: "arrived",
    label: "📍 Mark Arrived",
    color: "bg-purple-600 hover:bg-purple-700",
  },
  arrived: {
    next: "completed",
    label: "✅ Complete Ride",
    color: "bg-gray-600 hover:bg-gray-700",
  },
};

const STATUS_BADGE = {
  waiting: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  "en-route": "bg-blue-100 text-blue-800",
  arrived: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS = {
  waiting: "Waiting",
  active: "Active",
  "en-route": "En Route 🚗",
  arrived: "Arrived at Campus 🎓",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  online: "Online",
  none: "N/A",
};

export default function DashboardPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("myRides");
  const [filterPrefs, setFilterPrefs] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [autoProgressTimers, setAutoProgressTimers] = useState({});

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedPaymentRide, setSelectedPaymentRide] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [onlineStep, setOnlineStep] = useState("methods"); // methods, bkash, nagad, rocket
  const [walletNumber, setWalletNumber] = useState("");
  const [paymentPromptedRideIds, setPaymentPromptedRideIds] = useState([]);

  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingData, setRatingData] = useState({
    rideId: "",
    rating: 5,
    review: "",
    role: "",
  });
  const [viewingDocs, setViewingDocs] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [editFormData, setEditFormData] = useState({
    origin: "",
    destination: "",
    date: "",
    availableSeats: "",
    startTime: "",
    endTime: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    fare: "",
    description: "",
    status: "",
  });
  const socketRef = useRef(null);

  const toggleFilterPref = (pref) =>
    setFilterPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );

  const isUserPassenger = (ride) => {
    if (!user?._id) return false;
    const userId = String(user._id);

    if (ride?.riderId && String(ride.riderId) === userId) {
      return true;
    }

    return Array.isArray(ride?.passengers)
      ? ride.passengers.some((p) => String(p?._id || p) === userId)
      : false;
  };

  useEffect(() => {
    fetchProfileAndRides();

    // Listen for real-time status updates
    const socket = getSocket();
    socketRef.current = socket;
    socket.on("ride-status-changed", ({ rideId, status }) => {
      setRides((prev) =>
        prev.map((r) => (r._id === rideId ? { ...r, status } : r)),
      );
    });
    return () => {
      socket.off("ride-status-changed");
      // Clear all auto-progress timers
      Object.values(autoProgressTimers).forEach((timer) => clearTimeout(timer));
    };
  }, [autoProgressTimers]);

  useEffect(() => {
    const nextRide = rides.find(
      (ride) =>
        ride.status === "completed" &&
        ride.paymentStatus !== "paid" &&
        isUserPassenger(ride) &&
        !paymentPromptedRideIds.includes(ride._id),
    );

    if (!nextRide || showPaymentModal) return;

    setSelectedPaymentRide(nextRide);
    setShowPaymentModal(true);
    setPaymentPromptedRideIds((prev) => [...prev, nextRide._id]);
  }, [rides, paymentPromptedRideIds, showPaymentModal, user]);

  const myRides = rides.filter(
    (r) =>
      r.creator?._id === user?._id || (!r.creator && activeTab === "myRides"),
  );
  const othersRides = rides.filter(
    (r) => r.creator?._id !== user?._id && r.creator,
  );
  const currentRides = activeTab === "myRides" ? myRides : othersRides;

  const ridesToShow =
    filterPrefs.length > 0
      ? currentRides.filter(
          (r) =>
            Array.isArray(r.preferences) &&
            filterPrefs.every((p) => r.preferences.includes(p)),
        )
      : currentRides;

  const fetchProfileAndRides = async () => {
    setLoading(true);
    try {
      const [profileRes, ridesRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/rides"),
      ]);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUser(profileData.user);
      }
      const ridesData = await ridesRes.json();
      if (ridesData.success) {
        setRides(ridesData.data);
        setMessage("");
      } else {
        setMessage(`Error: ${ridesData.error}`);
      }
    } catch (error) {
      setMessage(`Error fetching data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Accept Ride
  const handleAcceptRide = async (rideId) => {
    try {
      const res = await fetch(`/api/rides/${rideId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Ride accepted successfully!");
        fetchProfileAndRides();
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  // Ride Status Automation
  const handleStatusAdvance = async (ride) => {
    const flow = STATUS_FLOW[ride.status];
    if (!flow) return;
    const newStatus = flow.next;
    setStatusUpdating(ride._id);
    try {
      const res = await fetch(`/api/rides/${ride._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setRides((prev) =>
          prev.map((r) =>
            r._id === ride._id ? { ...r, status: newStatus } : r,
          ),
        );
        socketRef.current?.emit("ride-status-update", {
          rideId: ride._id,
          status: newStatus,
          origin: ride.origin,
          destination: ride.destination,
        });
        setMessage(`Ride status updated to "${STATUS_LABELS[newStatus]}"`);
        setTimeout(() => setMessage(""), 3000);

        // Trigger payment modal if completed manually
        if (newStatus === "completed") {
          setSelectedPaymentRide(ride);
          setShowPaymentModal(true);
        }

        // Start auto-progress if starting the ride
        if (newStatus === "active") {
          startAutoProgress(ride._id);
        }
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setStatusUpdating(null);
    }
  };

  const startAutoProgress = (rideId) => {
    // Clear any existing timer for this ride
    if (autoProgressTimers[rideId]) {
      clearTimeout(autoProgressTimers[rideId]);
    }

    // Auto-progress: active -> en-route after 2 minutes
    const timer1 = setTimeout(async () => {
      await autoAdvanceStatus(rideId, "en-route");
      // Then en-route -> arrived after 3 minutes
      const timer2 = setTimeout(async () => {
        await autoAdvanceStatus(rideId, "arrived");
        // Then arrived -> completed after 1 minute
        const timer3 = setTimeout(async () => {
          await autoAdvanceStatus(rideId, "completed");
        }, 60000); // 1 minute
        setAutoProgressTimers((prev) => ({ ...prev, [rideId]: timer3 }));
      }, 180000); // 3 minutes
      setAutoProgressTimers((prev) => ({ ...prev, [rideId]: timer2 }));
    }, 120000); // 2 minutes

    setAutoProgressTimers((prev) => ({ ...prev, [rideId]: timer1 }));
  };

  const autoAdvanceStatus = async (rideId, newStatus) => {
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setRides((prev) =>
          prev.map((r) => (r._id === rideId ? { ...r, status: newStatus } : r)),
        );
        socketRef.current?.emit("ride-status-update", {
          rideId,
          status: newStatus,
        });
        setMessage(`Ride auto-progressed to "${STATUS_LABELS[newStatus]}"`);
        
        // Trigger payment modal if completed
        if (newStatus === "completed") {
          const ride = rides.find(r => r._id === rideId);
          if (ride) {
            setSelectedPaymentRide(ride);
            setShowPaymentModal(true);
          }
        }

        setTimeout(() => setMessage(""), 3000);
        // Clear timer if completed
        if (newStatus === "completed") {
          setAutoProgressTimers((prev) => {
            const newTimers = { ...prev };
            delete newTimers[rideId];
            return newTimers;
          });
        }
      }
    } catch (err) {
      console.error("Auto-advance error:", err);
    }
  };

  const callPaymentApi = async (rideId, payload) => {
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        const updatedRide = data.data;
        setRides((prev) =>
          prev.map((r) => (r._id === rideId ? { ...r, ...updatedRide } : r)),
        );
        return data;
      } else {
        setMessage(`Payment error: ${data.error}`);
        return null;
      }
    } catch (err) {
      setMessage(`Payment error: ${err.message}`);
      return null;
    } finally {
      setPaymentLoading(false);
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setOnlineStep("methods");
    setWalletNumber("");
  };

  const handlePassengerCashIntent = async (rideId) => {
    const data = await callPaymentApi(rideId, { action: "cash-intent" });
    if (!data) return;
    closePaymentModal();
    setMessage("Cash payment request sent. Driver will confirm after receiving cash.");
  };

  const handleDriverCashConfirm = async (rideId) => {
    const data = await callPaymentApi(rideId, { action: "driver-confirm-cash" });
    if (!data) return;
    closePaymentModal();
    setShowSuccessModal(true);
  };

  const handleOnlinePayment = async (rideId, method) => {
    const data = await callPaymentApi(rideId, { action: "online-pay", method });
    if (!data) return;
    closePaymentModal();
    setShowSuccessModal(true);
  };

  const handleCancelRide = async (id) => {
    if (!confirm("Cancel this ride?")) return;
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (data.success) {
        setRides((prev) =>
          prev.map((r) => (r._id === id ? { ...r, status: "cancelled" } : r)),
        );
        socketRef.current?.emit("ride-status-update", {
          rideId: id,
          status: "cancelled",
        });
        // Clear auto-progress timer
        if (autoProgressTimers[id]) {
          clearTimeout(autoProgressTimers[id]);
          setAutoProgressTimers((prev) => {
            const newTimers = { ...prev };
            delete newTimers[id];
            return newTimers;
          });
        }
      }
    } catch {}
  };

  const handleEditClick = (ride) => {
    const [startTime, endTime] = ride.time.split(" - ");
    setEditingId(ride._id);
    setEditFormData({
      origin: ride.origin,
      destination: ride.destination,
      date: ride.date.split("T")[0],
      availableSeats: ride.seats.toString(),
      startTime,
      endTime,
      vehicleType: ride.vehicleType,
      vehicleNumber: ride.vehicleNumber,
      driverName: ride.driverName,
      driverPhone: ride.driverPhone,
      fare: ride.fare.toString(),
      description: ride.description,
      status: ride.status,
    });
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateRide = async (id) => {
    try {
      const updateData = {
        origin: editFormData.origin.trim(),
        destination: editFormData.destination.trim(),
        date: new Date(editFormData.date),
        time: `${editFormData.startTime} - ${editFormData.endTime}`,
        seats: parseInt(editFormData.availableSeats),
        vehicleType: editFormData.vehicleType,
        vehicleNumber: editFormData.vehicleNumber.trim(),
        driverName: editFormData.driverName.trim(),
        driverPhone: editFormData.driverPhone.trim(),
        fare: parseInt(editFormData.fare),
        description: editFormData.description.trim(),
        status: editFormData.status,
      };
      const res = await fetch(`/api/rides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Ride updated successfully!");
        setEditingId(null);
        fetchProfileAndRides();
      } else setMessage(`Error: ${data.error}`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleDeleteRide = async (id) => {
    if (!confirm("Delete this ride?")) return;
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMessage("Ride deleted successfully!");
        fetchProfileAndRides();
      } else setMessage(`Error: ${data.error}`);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditFormData({
      origin: "",
      destination: "",
      date: "",
      availableSeats: "",
      startTime: "",
      endTime: "",
      vehicleType: "",
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      fare: "",
      description: "",
      status: "",
    });
  };

  const handleViewDocs = async (ride) => {
    if (!ride.hasApprovedDocs) {
      setMessage("No approved documents available for this driver.");
      return;
    }
    setViewingDocs(ride);
    try {
      const res = await fetch(
        `/api/driver-docs?email=${encodeURIComponent(ride.creator.email)}`,
      );
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setDocsData(data.data[0]);
      } else {
        setMessage("Failed to load documents.");
      }
    } catch (error) {
      setMessage("Error loading documents.");
    }
  };

  const handleCloseDocs = () => {
    setViewingDocs(null);
    setDocsData(null);
  };

  const handleOpenRatingModal = (rideId, role) => {
    setRatingData({ rideId, rating: 5, review: "", role });
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    try {
      const response = await fetch(`/api/rides/${ratingData.rideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: ratingData.rating,
          review: ratingData.review,
          role: ratingData.role,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage("Rating submitted successfully!");
        setShowRatingModal(false);
        fetchProfileAndRides();
      } else {
        setMessage(`Error: ${data.error}`);
        if (data.error.includes("Fraud")) {
          setShowRatingModal(false);
          fetchProfileAndRides();
        }
      }
    } catch (error) {
      setMessage(`Error submitting rating: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center p-4">
        {/* Main card */}
        <div className="w-full max-w-5xl bg-white shadow-lg rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-green-600 text-white py-4 px-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold">GoRide Dashboard</h1>
            <div className="flex gap-2">
              <a
                href="/DriverDocs"
                className="text-sm bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition font-medium"
              >
                📋 Driver Docs
              </a>
              <Link
                href="/profile"
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold shadow-sm hover:bg-gray-100 transition-colors text-sm"
              >
                My Profile
              </Link>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
              <button
                className={`pb-2 px-1 font-semibold text-lg ${activeTab === "myRides" ? "border-b-2 border-green-600 text-green-600" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("myRides")}
              >
                My Rides
              </button>
              <button
                className={`pb-2 px-1 font-semibold text-lg ${activeTab === "othersRides" ? "border-b-2 border-green-600 text-green-600" : "text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("othersRides")}
              >
                Other&apos;s Rides
              </button>
            </div>

            {/* Filter */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowFilterModal(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Filter Preferences
              </button>
              {filterPrefs.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {filterPrefs.map((name) => {
                      const opt = nameToOption[name];
                      if (!opt) return null;
                      const colorMap = {
                        pink: "bg-pink-100 text-pink-800",
                        gray: "bg-gray-100 text-gray-800",
                        blue: "bg-blue-100 text-blue-800",
                        purple: "bg-purple-100 text-purple-800",
                        yellow: "bg-yellow-100 text-yellow-800",
                        orange: "bg-orange-100 text-orange-800",
                        cyan: "bg-cyan-100 text-cyan-800",
                        green: "bg-green-100 text-green-800",
                      };
                      return (
                        <span
                          key={name}
                          className={`${colorMap[opt.color] || colorMap.gray} px-2 py-1 text-xs rounded-full`}
                        >
                          {opt.label}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setFilterPrefs([])}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            {/* Message */}
            {message && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
              >
                {message}
              </div>
            )}

            {/* Status Legend (My Rides only) */}
            {activeTab === "myRides" && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 mb-2">
                  🚦 Ride Status Flow (Automation)
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    "waiting",
                    "active",
                    "en-route",
                    "arrived",
                    "completed",
                  ].map((s, i, arr) => (
                    <React.Fragment key={s}>
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[s]}`}
                      >
                        {STATUS_LABELS[s]}
                      </span>
                      {i < arr.length - 1 && (
                        <span className="text-gray-400 self-center">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Rides */}
            {loading ? (
              <div className="text-center py-8 text-gray-600">
                Loading rides...
              </div>
            ) : currentRides.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                {activeTab === "myRides"
                  ? "No rides offered yet. Start by offering a ride!"
                  : "No rides available from others."}
              </div>
            ) : ridesToShow.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                No rides match the selected preferences.
              </div>
            ) : (
              <div className="space-y-4">
                {ridesToShow.map((ride) => (
                  <div
                    key={ride._id}
                    className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white transition shadow-xs"
                  >
                    {editingId === ride._id ? (
                      /* Edit Form */
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Edit Ride
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            ["origin", "Origin", "text"],
                            ["destination", "Destination", "text"],
                          ].map(([n, l, t]) => (
                            <div key={n}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {l}
                              </label>
                              <input
                                type={t}
                                name={n}
                                value={editFormData[n]}
                                onChange={handleEditInputChange}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              name="date"
                              value={editFormData.date}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Available Seats
                            </label>
                            <input
                              type="number"
                              name="availableSeats"
                              value={editFormData.availableSeats}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Time
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="time"
                              name="startTime"
                              value={editFormData.startTime}
                              onChange={handleEditInputChange}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                              type="time"
                              name="endTime"
                              value={editFormData.endTime}
                              onChange={handleEditInputChange}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Vehicle Type
                            </label>
                            <select
                              name="vehicleType"
                              value={editFormData.vehicleType}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                            >
                              <option value="">Select vehicle type</option>
                              <option value="Car">Car</option>
                              <option value="Micro">Micro</option>
                              <option value="Bike">Bike</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Vehicle Number
                            </label>
                            <input
                              type="text"
                              name="vehicleNumber"
                              value={editFormData.vehicleNumber}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Driver Name
                            </label>
                            <input
                              type="text"
                              name="driverName"
                              value={editFormData.driverName}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Driver Phone
                            </label>
                            <input
                              type="tel"
                              name="driverPhone"
                              value={editFormData.driverPhone}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Fare (৳)
                            </label>
                            <input
                              type="number"
                              name="fare"
                              value={editFormData.fare}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Status
                            </label>
                            <select
                              name="status"
                              value={editFormData.status}
                              onChange={handleEditInputChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white"
                            >
                              <option value="waiting">Waiting</option>
                              <option value="active">Active</option>
                              <option value="en-route">En Route</option>
                              <option value="arrived">Arrived</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            name="description"
                            value={editFormData.description}
                            onChange={handleEditInputChange}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleUpdateRide(ride._id)}
                            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition"
                          >
                            Save Changes
                          </button>
                          <button
                            onClick={handleCancel}
                            className="bg-gray-400 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Ride Card */
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800">
                              {ride.origin} → {ride.destination}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(ride.date).toLocaleDateString()} ·{" "}
                              {ride.time}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_BADGE[ride.status] || "bg-gray-100 text-gray-700"}`}
                            >
                              {STATUS_LABELS[ride.status] || ride.status}
                            </span>
                            {ride.paymentStatus === "paid" ? (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                PAID via {PAYMENT_METHOD_LABELS[ride.paymentMethod] || String(ride.paymentMethod || "").toUpperCase()}
                              </span>
                            ) : ride.paymentStatus === "pending" ? (
                              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                CASH PENDING DRIVER CONFIRMATION
                              </span>
                            ) : ride.status === "completed" ? (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                UNPAID
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                          <div>
                            <p className="text-gray-500">Seats</p>
                            <p className="font-semibold text-gray-800">
                              {ride.seats}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vehicle</p>
                            <p className="font-semibold text-gray-800">
                              {ride.vehicleType}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Vehicle #</p>
                            <p className="font-semibold text-gray-800">
                              {ride.vehicleNumber}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Fare</p>
                            <p className="font-semibold text-gray-800">
                              {ride.fare ? `৳${ride.fare}` : "TBD"}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 text-sm">
                          <div>
                            <p className="text-gray-500">Driver</p>
                            <p className="font-semibold text-gray-800">
                              {ride.driverName}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Phone</p>
                            <p className="font-semibold text-gray-800">
                              {ride.driverPhone}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Docs</p>
                            <button
                              onClick={() => handleViewDocs(ride)}
                              className={`font-semibold ${ride.hasApprovedDocs ? "text-green-600 hover:text-green-700" : "text-red-600 hover:text-red-700"} underline`}
                            >
                              {ride.hasApprovedDocs
                                ? "✓ Approved"
                                : "✗ Pending"}
                            </button>
                          </div>
                          {ride.distanceKm && (
                            <div>
                              <p className="text-gray-500">Distance</p>
                              <p className="font-semibold text-gray-800">
                                {ride.distanceKm} km
                              </p>
                            </div>
                          )}
                          {ride.duration && (
                            <div>
                              <p className="text-gray-500">Est. Time</p>
                              <p className="font-semibold text-gray-800">
                                {ride.duration}
                              </p>
                            </div>
                          )}
                          {ride.description && (
                            <div>
                              <p className="text-gray-500">Note</p>
                              <p className="font-semibold text-gray-800">
                                {ride.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* My Rides: Status Automation + Edit/Delete */}
                        {activeTab === "myRides" && (
                          <>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {STATUS_FLOW[ride.status] && (
                                <button
                                  onClick={() => handleStatusAdvance(ride)}
                                  disabled={statusUpdating === ride._id}
                                  className={`${STATUS_FLOW[ride.status].color} text-white font-medium py-2 px-4 rounded-lg transition text-sm disabled:opacity-50`}
                                >
                                  {statusUpdating === ride._id
                                    ? "Updating..."
                                    : STATUS_FLOW[ride.status].label}
                                </button>
                              )}
                              {ride.status !== "cancelled" &&
                                ride.status !== "completed" && (
                                  <button
                                    onClick={() => handleCancelRide(ride._id)}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 px-4 rounded-lg transition text-sm"
                                  >
                                    ✕ Cancel Ride
                                  </button>
                                )}
                              {ride.status === "completed" && ride.paymentStatus !== "paid" && (
                                <button
                                  onClick={() => {
                                    setSelectedPaymentRide(ride);
                                    setShowPaymentModal(true);
                                  }}
                                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
                                >
                                  💰 {ride.paymentStatus === "pending" ? "Confirm Cash Received" : "Confirm Payment"}
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2 border-t border-gray-100 pt-3">
                              <button
                                onClick={() => handleEditClick(ride)}
                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRide(ride._id)}
                                className="text-sm bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg transition"
                              >
                                Delete
                              </button>
                              {[
                                "waiting",
                                "active",
                                "en-route",
                                "arrived",
                              ].includes(ride.status) && (
                                <button
                                  onClick={() =>
                                    window.dispatchEvent(
                                      new CustomEvent("open-ride-chat", {
                                        detail: ride,
                                      }),
                                    )
                                  }
                                  className="text-sm bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded-lg transition ml-auto"
                                >
                                  💬 Chat
                                </button>
                              )}
                              {ride.status === "completed" &&
                                !ride.riderRating && (
                                  <button
                                    onClick={() =>
                                      handleOpenRatingModal(ride._id, "driver")
                                    }
                                    className="text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium py-1.5 px-3 rounded-lg transition"
                                  >
                                    ⭐ Rate Rider
                                  </button>
                                )}
                            </div>
                          </>
                        )}

                        {/* Others' Rides: Accept button */}
                        {activeTab === "othersRides" && (
                          <div className="flex gap-3 items-center border-t border-gray-100 pt-3">
                            <button
                              onClick={() => handleAcceptRide(ride._id)}
                              disabled={
                                ride.seats <= 0 ||
                                (user && isUserPassenger(ride))
                              }
                              className={`font-medium py-2 px-6 rounded-lg transition ${
                                user && isUserPassenger(ride)
                                  ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                                  : ride.seats <= 0
                                    ? "bg-red-100 text-red-800 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700 text-white"
                              }`}
                            >
                              {user && isUserPassenger(ride)
                                ? "Accepted"
                                : ride.seats <= 0
                                  ? "Full"
                                  : "Accept Ride"}
                            </button>
                            
                            {ride.status === "completed" && ride.paymentStatus !== "paid" && user && isUserPassenger(ride) && (
                              <button
                                onClick={() => {
                                  setSelectedPaymentRide(ride);
                                  setShowPaymentModal(true);
                                }}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
                              >
                                💳 {ride.paymentStatus === "pending" ? "Payment Pending" : "Pay Now"}
                              </button>
                            )}

                            {ride.status === "completed" &&
                              user &&
                              isUserPassenger(ride) &&
                              !ride.driverRating && (
                                <button
                                  onClick={() =>
                                    handleOpenRatingModal(ride._id, "rider")
                                  }
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition"
                                >
                                  ⭐ Rate Driver
                                </button>
                              )}
                            {ride.creator && (
                              <span className="text-sm text-gray-500 ml-auto">
                                Offered by:{" "}
                                <span className="font-semibold text-gray-700">
                                  {ride.creator.name}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Modal */}
          {showPaymentModal && selectedPaymentRide && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className={`p-6 text-white text-center transition-colors duration-500 ${
                  onlineStep === "bkash" ? "bg-[#D12053]" : 
                  onlineStep === "nagad" ? "bg-[#F7941D]" : 
                  onlineStep === "rocket" ? "bg-[#8C3494]" : "bg-gradient-to-r from-orange-500 to-orange-600"
                }`}>
                  <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    {onlineStep === "methods" ? "💰" : "📱"}
                  </div>
                  <h2 className="text-2xl font-bold">
                    {onlineStep === "methods" ? "Ride Payment" : 
                    onlineStep === "bkash" ? "bKash Payment" :
                     onlineStep === "nagad" ? "Nagad Payment" : "Rocket Payment"}
                  </h2>
                  <p className="opacity-90">Total Fare to Pay</p>
                  <div className="text-4xl font-extrabold mt-1">৳{selectedPaymentRide.fare}</div>
                </div>

                <div className="p-6 space-y-6">
                  {onlineStep === "methods" ? (
                    <>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Route</span>
                          <span className="font-semibold text-gray-800">{selectedPaymentRide.origin.split(',')[0]} → {selectedPaymentRide.destination.split(',')[0]}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Driver</span>
                          <span className="font-semibold text-gray-800">{selectedPaymentRide.driverName}</span>
                        </div>
                      </div>

                      {/* Options for Passenger */}
                      {isUserPassenger(selectedPaymentRide) ? (
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">Choose Payment Method</p>
                          
                          <button
                            onClick={() => handlePassengerCashIntent(selectedPaymentRide._id)}
                            disabled={paymentLoading}
                            className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition group"
                          >
                            <div className="bg-green-100 text-green-600 w-12 h-12 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition">
                              💵
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-gray-800">I Paid in Cash</div>
                              <div className="text-xs text-gray-500">Notify driver to confirm receipt</div>
                            </div>
                          </button>

                          <div className="grid grid-cols-3 gap-3">
                            <button
                              onClick={() => setOnlineStep("bkash")}
                              className="flex flex-col items-center p-3 border-2 border-gray-100 rounded-xl hover:border-[#D12053] hover:bg-pink-50 transition"
                            >
                              <div className="text-2xl mb-1">🎀</div>
                              <span className="text-[10px] font-bold text-[#D12053]">bKash</span>
                            </button>
                            <button
                              onClick={() => setOnlineStep("nagad")}
                              className="flex flex-col items-center p-3 border-2 border-gray-100 rounded-xl hover:border-[#F7941D] hover:bg-orange-50 transition"
                            >
                              <div className="text-2xl mb-1">🔸</div>
                              <span className="text-[10px] font-bold text-[#F7941D]">Nagad</span>
                            </button>
                            <button
                              onClick={() => setOnlineStep("rocket")}
                              className="flex flex-col items-center p-3 border-2 border-gray-100 rounded-xl hover:border-[#8C3494] hover:bg-purple-50 transition"
                            >
                              <div className="text-2xl mb-1">🚀</div>
                              <span className="text-[10px] font-bold text-[#8C3494]">Rocket</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Driver View */
                        <div className="text-center space-y-4">
                          <div className="p-4 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
                            {selectedPaymentRide.paymentStatus === "pending"
                              ? "Passenger marked cash payment. Confirm when you receive cash in real life."
                              : "Confirm cash only after receiving payment in real life."}
                          </div>
                          <button
                            onClick={() => handleDriverCashConfirm(selectedPaymentRide._id)}
                            disabled={paymentLoading}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition transform active:scale-95 disabled:opacity-50"
                          >
                            {paymentLoading ? "Confirming..." : "Confirm Cash Received"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Digital Wallet Step */
                    <div className="space-y-4 animate-in slide-in-from-right duration-300">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Enter {PAYMENT_METHOD_LABELS[onlineStep] || onlineStep} Number
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">+880</span>
                          <input
                            type="tel"
                            maxLength="11"
                            value={walletNumber}
                            onChange={(e) => setWalletNumber(e.target.value.replace(/\D/g, ""))}
                            placeholder="1XXXXXXXXX"
                            className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-0 text-lg tracking-widest font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={() => handleOnlinePayment(selectedPaymentRide._id, onlineStep)}
                          disabled={paymentLoading || walletNumber.length < 10}
                          className={`w-full py-4 rounded-xl text-white font-bold shadow-lg transition active:scale-95 disabled:opacity-50 ${
                            onlineStep === "bkash" ? "bg-[#D12053] hover:bg-[#B01B46]" : 
                            onlineStep === "nagad" ? "bg-[#F7941D] hover:bg-[#E0851A]" : 
                            "bg-[#8C3494] hover:bg-[#762C7D]"
                          }`}
                        >
                          {paymentLoading ? "Processing..." : `Pay ৳${selectedPaymentRide.fare} Now`}
                        </button>
                        <button
                          onClick={() => {
                            setOnlineStep("methods");
                            setWalletNumber("");
                          }}
                          className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700 transition"
                        >
                          ← Change Method
                        </button>
                      </div>
                      
                      <p className="text-[10px] text-center text-gray-400">
                        Secure 128-bit encrypted payment gateway
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={closePaymentModal}
                    className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal */}
          {showSuccessModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl animate-bounce">
                  ✓
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Success!</h2>
                <p className="text-gray-600 text-lg font-medium mb-8">
                  Your payment is completed
                </p>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-200 transition transform active:scale-95"
                >
                  Great!
                </button>
              </div>
            </div>
          )}

          <PreferencesModal
            show={showFilterModal}
            onClose={() => setShowFilterModal(false)}
            selectedPrefs={filterPrefs}
            togglePreference={toggleFilterPref}
          />

          {/* Driver Docs Modal */}
          {viewingDocs && docsData && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                      Driver Documents
                    </h2>
                    <button
                      onClick={handleCloseDocs}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <strong>Name:</strong> {docsData.driverName}
                    </div>
                    <div>
                      <strong>Email:</strong> {docsData.email}
                    </div>
                    <div>
                      <strong>Phone:</strong> {docsData.phone}
                    </div>
                    <div>
                      <strong>Vehicle:</strong> {docsData.vehicleType} -{" "}
                      {docsData.vehicleNumber}
                    </div>
                    <div>
                      <strong>Status:</strong>{" "}
                      <span className="text-green-600 font-semibold">
                        {docsData.status}
                      </span>
                    </div>
                    {docsData.notes && (
                      <div>
                        <strong>Notes:</strong> {docsData.notes}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <strong>License:</strong>
                        <img
                          src={`/api/driver-docs/file/${docsData.licenseFileName}`}
                          alt="License"
                          className="mt-2 max-w-full h-auto border rounded"
                        />
                      </div>
                      <div>
                        <strong>Registration:</strong>
                        <img
                          src={`/api/driver-docs/file/${docsData.registrationFileName}`}
                          alt="Registration"
                          className="mt-2 max-w-full h-auto border rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rating Modal */}
          {showRatingModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Rate your {ratingData.role === "rider" ? "Driver" : "Rider"}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rating (1-5 stars)
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() =>
                            setRatingData({ ...ratingData, rating: star })
                          }
                          className={`text-3xl ${ratingData.rating >= star ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review (Optional)
                    </label>
                    <textarea
                      value={ratingData.review}
                      onChange={(e) =>
                        setRatingData({ ...ratingData, review: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                      rows="3"
                      placeholder="How was the experience?"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSubmitRating}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition duration-200"
                    >
                      Submit Rating
                    </button>
                    <button
                      onClick={() => setShowRatingModal(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg transition duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer navigation */}
          <div className="border-t border-gray-200 bg-gray-50 py-3 px-6">
            <div className="flex justify-center space-x-8 text-gray-700 font-medium text-sm">
              <a href="/" className="cursor-pointer hover:text-green-600">
                Home
              </a>
              <a
                href="/OfferRide"
                className="cursor-pointer hover:text-green-600"
              >
                Offer Ride
              </a>
              <a
                href="/DriverDocs"
                className="cursor-pointer hover:text-green-600"
              >
                Driver Docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}