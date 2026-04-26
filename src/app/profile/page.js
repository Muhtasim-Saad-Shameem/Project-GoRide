"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/reviews/history"),
        ]);

        if (profileRes.ok) {
          const data = await profileRes.json();
          setUser(data.user);

          if (historyRes.ok) {
            const historyData = await historyRes.json();
            setReviewHistory(Array.isArray(historyData.data) ? historyData.data : []);
          }
        } else {
          // If unauthorized, redirect to login
          router.push("/login");
        }
      } catch (err) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    // A simple way to logout is to delete the cookie.
    // We can just clear it via an API or document.cookie
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center mt-20 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {/* Profile Header */}
          <div className="bg-green-600 px-8 py-10 text-white flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-green-600 text-4xl font-bold uppercase shadow-inner">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{user?.name}</h1>
                <p className="text-green-100 mt-1">{user?.department} Student</p>
              </div>
            </div>
            <div className="mt-6 md:mt-0 flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4">
              <button 
                onClick={() => router.push('/OfferRide')}
                className="bg-white text-green-600 hover:bg-green-50 px-6 py-2.5 rounded-lg shadow transition font-bold flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                <span>Offer a Ride</span>
              </button>
              <button 
                onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-lg backdrop-blur-sm transition font-medium text-white border border-white/40"
              >
                Log Out
              </button>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Account Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Student ID</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.studentId}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">University Email</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.email}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Department</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.department}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Sex</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.sex}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Phone Number</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.phone}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Home Address</p>
                <p className="text-lg text-gray-900 font-semibold">{user?.address}</p>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-4 rounded-xl border border-green-200">
                <p className="text-sm text-green-800 font-bold mb-1 flex items-center gap-2">
                  <span>⭐</span> Trust Score
                </p>
                <p className="text-2xl text-green-600 font-extrabold">{user?.trustScore?.toFixed(1) || "5.0"}</p>
                <p className="text-xs text-green-700 mt-1">Based on {user?.totalRatings || 0} reviews</p>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-100 p-4 rounded-xl border border-green-200">
                <p className="text-sm text-green-800 font-bold mb-1 flex items-center gap-2">
                  <span>🌿</span> GoRide Impact Points
                </p>
                <p className="text-2xl text-green-600 font-extrabold">{user?.impactPoints || 0} pts</p>
                <p className="text-xs text-green-700 mt-1">Earned by saving CO₂ emissions!</p>
              </div>
            </div>

            {user?.isFlagged && (
              <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200 flex items-start space-x-3">
                <div className="text-red-600 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-900">Account Flagged</h4>
                  <p className="text-sm text-red-700 mt-1">Your account has been flagged for suspicious activity. Your Trust Score has been reset.</p>
                </div>
              </div>
            )}
            
            <div className="mt-10 p-4 bg-green-50 rounded-lg border border-green-100 flex items-start space-x-3">
              <div className="text-green-600 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-green-900">Verified Account</h4>
                <p className="text-sm text-green-700 mt-1">Your ID card has been successfully verified by GoRide.</p>
              </div>
            </div>


          </div>

          <div id="review-history" className="px-8 pb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">
              Review History
            </h2>

            {reviewHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviewHistory.map((entry) => (
                  <div
                    key={entry._id}
                    className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {entry.ride?.origin || "Unknown"} → {entry.ride?.destination || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleString()
                            : "Unknown date"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        {entry.rating ? `${entry.rating}/5` : "N/A"}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-2">
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {entry.direction === "received" ? "Received" : "Given"}
                      </span>
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full capitalize">
                        {entry.role || "rating"}
                      </span>
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {entry.targetUser?.name || "Unknown User"}
                      </span>
                    </div>

                    {entry.review ? (
                      <p className="mt-3 text-sm text-gray-800">{entry.review}</p>
                    ) : (
                      <p className="mt-3 text-sm text-gray-400 italic">No written review</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
