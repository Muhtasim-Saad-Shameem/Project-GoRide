"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

import {
  departments,
  buildings,
  departmentMap,
  buildingMap,
} from "@/lib/campusOptions";

const VEHICLE_TYPES = ["Car", "Motorcycle", "Bus", "Van", "Micro", "Bike"];

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
  "en-route": "En Route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

const emptyFilters = {
  department: "",
  building: "",
  origin: "",
  destination: "",
  date: "",
  vehicleType: "",
};

export default function FindRidePage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [rides, setRides] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const buildQueryString = (f) => {
    const params = new URLSearchParams();
    if (f.department) params.set("department", f.department);
    if (f.building) params.set("building", f.building);
    if (f.origin) params.set("origin", f.origin);
    if (f.destination) params.set("destination", f.destination);
    if (f.date) params.set("date", f.date);
    if (f.vehicleType) params.set("vehicleType", f.vehicleType);
    return params.toString();
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const qs = buildQueryString(filters);
      const res = await fetch(`/api/rides?${qs}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text.slice(0, 120)}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");

      // Keep only active / waiting rides
      const visible = data.data.filter(
        (r) => r.status === "active" || r.status === "waiting",
      );
      setRides(visible);
      setSearched(true);
    } catch (err) {
      setError(`Error fetching rides: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters(emptyFilters);
    setRides([]);
    setSearched(false);
    setError("");
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col items-center p-4">
        <div className="w-full max-w-4xl">
          {/* Page header */}
          <div className="bg-green-600 text-white py-5 px-6 rounded-t-xl">
            <h1 className="text-2xl font-bold">Find a Ride</h1>
            <p className="text-green-100 text-sm mt-1">
              Search by department, building, route, date, or vehicle type
            </p>
          </div>

          {/* Filter panel */}
          <div className="bg-white shadow-lg rounded-b-xl overflow-hidden">
            <form onSubmit={handleSearch} className="p-6 space-y-5">
              {/* Row 1 – Department + Building */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    name="department"
                    value={filters.department}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Building / Destination on Campus
                  </label>
                  <select
                    name="building"
                    value={filters.building}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">All Buildings</option>
                    {buildings.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2 – Origin + Destination text search */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origin (from)
                  </label>
                  <input
                    type="text"
                    name="origin"
                    value={filters.origin}
                    onChange={handleChange}
                    placeholder="e.g. Banani, Mirpur"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination (to)
                  </label>
                  <input
                    type="text"
                    name="destination"
                    value={filters.destination}
                    onChange={handleChange}
                    placeholder="e.g. BRAC University, Mohakhali"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>

              {/* Row 3 – Date + Vehicle type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={filters.date}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Type
                  </label>
                  <select
                    name="vehicleType"
                    value={filters.vehicleType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">Any Vehicle</option>
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.department && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Dept:{" "}
                      {departmentMap[filters.department] || filters.department}
                    </span>
                  )}
                  {filters.building && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      Building:{" "}
                      {buildingMap[filters.building] || filters.building}
                    </span>
                  )}
                  {filters.origin && (
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                      From: {filters.origin}
                    </span>
                  )}
                  {filters.destination && (
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                      To: {filters.destination}
                    </span>
                  )}
                  {filters.date && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                      Date: {filters.date}
                    </span>
                  )}
                  {filters.vehicleType && (
                    <span className="bg-cyan-100 text-cyan-800 text-xs px-2 py-1 rounded-full">
                      Vehicle: {filters.vehicleType}
                    </span>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition text-sm"
                >
                  {loading ? "Searching..." : "Search Rides"}
                </button>
                {(activeFilterCount > 0 || searched) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition text-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </form>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            {searched && (
              <div className="border-t border-gray-100 px-6 pb-6">
                <div className="flex items-center justify-between py-4">
                  <h2 className="text-base font-semibold text-gray-800">
                    {rides.length === 0
                      ? "No rides found"
                      : `${rides.length} ride${rides.length !== 1 ? "s" : ""} found`}
                  </h2>
                  {rides.length > 0 && (
                    <span className="text-xs text-gray-500">
                      Showing active & waiting rides
                    </span>
                  )}
                </div>

                {rides.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="font-medium">No matching rides available</p>
                    <p className="text-sm mt-1">
                      Try adjusting your filters or clearing some criteria
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rides.map((ride) => (
                      <RideCard 
                        key={ride._id} 
                        ride={ride}
                        onViewDetails={() => {
                          setSelectedRide(ride);
                          setShowModal(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer nav */}
            <div className="border-t border-gray-200 bg-gray-50 py-3 px-6">
              <div className="flex justify-center space-x-8 text-gray-700 font-medium text-sm">
                <a href="/" className="hover:text-green-600">
                  Home
                </a>
                <a href="/OfferRide" className="hover:text-green-600">
                  Offer Ride
                </a>
                <a href="/Dashboard" className="hover:text-green-600">
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ride Details Modal */}
      {showModal && selectedRide && (
        <RideDetailsModal 
          ride={selectedRide} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </div>
  );
}

function RideCard({ ride, onViewDetails }) {
  const router = useRouter();

  const handleConfirmRide = async () => {
    try {
      const response = await fetch(`/api/rides/${ride._id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riderId: "current-user-id" }), // Replace with actual user ID
      });

      if (response.ok) {
        alert(`✓ Ride confirmed! Driver will contact you soon.`);
        router.push("/Dashboard");
      } else {
        alert("Failed to confirm ride. Please try again.");
      }
    } catch (error) {
      alert("Error confirming ride: " + error.message);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white transition shadow-sm">
      {/* Route + status */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            {ride.origin} → {ride.destination}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(ride.date).toLocaleDateString("en-BD", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            {ride.time ? ` · ${ride.time}` : ""}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[ride.status] || "bg-gray-100 text-gray-700"}`}
        >
          {STATUS_LABELS[ride.status] || ride.status}
        </span>
      </div>

      {/* Department + Building tags */}
      {(ride.department || ride.buildingName) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ride.department && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">
              {departmentMap[ride.department] || ride.department}
            </span>
          )}
          {ride.buildingName && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
              {buildingMap[ride.buildingName] || ride.buildingName}
            </span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Seats</p>
          <p className="font-semibold text-gray-800">{ride.seats}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Vehicle</p>
          <p className="font-semibold text-gray-800">{ride.vehicleType}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Driver</p>
          <p className="font-semibold text-gray-800">{ride.driverName}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Fare</p>
          <p className="font-semibold text-gray-800">
            {ride.fare ? `৳${ride.fare}` : "TBD"}
          </p>
        </div>
      </div>

      {/* Docs indicator */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-500">Driver Docs:</span>
        <span
          className={`text-xs font-semibold ${ride.hasApprovedDocs ? "text-green-600" : "text-red-600"}`}
        >
          {ride.hasApprovedDocs ? "✓ Approved" : "✗ Pending"}
        </span>
      </div>

      {/* Contact row */}
      {ride.driverPhone && ride.driverPhone !== "TBD" && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          <span className="text-xs text-gray-500">Contact driver:</span>
          <a
            href={`tel:${ride.driverPhone}`}
            className="text-xs font-medium text-green-700 hover:underline"
          >
            {ride.driverPhone}
          </a>
        </div>
      )}

      {/* Description */}
      {ride.description && (
        <p className="mt-2 text-xs text-gray-500 italic">{ride.description}</p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={onViewDetails}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
        >
          View Details
        </button>
        <button
          onClick={handleConfirmRide}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function RideDetailsModal({ ride, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Ride Details</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-green-800 rounded-full p-2 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Route Section */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Route</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-500">From</p>
                <p className="text-lg font-semibold text-gray-800">{ride.origin}</p>
              </div>
              <div className="text-gray-400">→</div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">To</p>
                <p className="text-lg font-semibold text-gray-800">{ride.destination}</p>
              </div>
            </div>
          </div>

          {/* Date & Time Section */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="text-base font-semibold text-gray-800">
                  {new Date(ride.date).toLocaleDateString("en-BD", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Time</p>
                <p className="text-base font-semibold text-gray-800">{ride.time || "Not specified"}</p>
              </div>
            </div>
          </div>

          {/* Driver Section */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Driver Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Driver Name</p>
                <p className="text-base font-semibold text-gray-800">{ride.driverName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                {ride.driverPhone && ride.driverPhone !== "TBD" ? (
                  <a
                    href={`tel:${ride.driverPhone}`}
                    className="text-base font-semibold text-green-600 hover:underline"
                  >
                    {ride.driverPhone}
                  </a>
                ) : (
                  <p className="text-base font-semibold text-gray-800">TBD</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">License Plate</p>
                <p className="text-base font-semibold text-gray-800">{ride.licensePlate || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rating</p>
                <p className="text-base font-semibold text-gray-800">{ride.driverRating || "New"}</p>
              </div>
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Vehicle Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Vehicle Type</p>
                <p className="text-base font-semibold text-gray-800">{ride.vehicleType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Seats</p>
                <p className="text-base font-semibold text-gray-800">{ride.seats}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Color</p>
                <p className="text-base font-semibold text-gray-800">{ride.vehicleColor || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[ride.status] || "bg-gray-100 text-gray-700"}`}
                >
                  {STATUS_LABELS[ride.status] || ride.status}
                </span>
              </div>
            </div>
          </div>

          {/* Location Section */}
          {(ride.department || ride.buildingName) && (
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Campus Location</h3>
              <div className="flex flex-wrap gap-2">
                {ride.department && (
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    {departmentMap[ride.department] || ride.department}
                  </span>
                )}
                {ride.buildingName && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {buildingMap[ride.buildingName] || ride.buildingName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Fare Section */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Pricing</h3>
            <div>
              <p className="text-sm text-gray-500">Fare</p>
              <p className="text-2xl font-bold text-green-600">
                {ride.fare ? `৳${ride.fare}` : "TBD"}
              </p>
            </div>
          </div>

          {/* Docs & Description Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Additional Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Driver Verification</p>
                <div className="flex items-center mt-1">
                  <span
                    className={`text-base font-semibold ${ride.hasApprovedDocs ? "text-green-600" : "text-red-600"}`}
                  >
                    {ride.hasApprovedDocs ? "✓ Approved" : "✗ Pending"}
                  </span>
                </div>
              </div>
              {ride.description && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-base text-gray-700 mt-1">{ride.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition"
          >
            Close
          </button>
          <button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition"
          >
            Confirm Ride
          </button>
        </div>
      </div>
    </div>
  );
}
