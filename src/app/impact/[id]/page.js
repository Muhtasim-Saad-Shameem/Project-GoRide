'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Link from 'next/link';
import { use } from 'react';

export default function ImpactDashboard() {
  const router = useRouter();
  // In Next.js 15, params is a Promise, so we must unwrap it with React.use()
  const params = useParams();
  const id = params?.id;
  
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Animated values
  const [displayKm, setDisplayKm] = useState(0);
  const [displayMoney, setDisplayMoney] = useState(0);
  const [displayCo2, setDisplayCo2] = useState(0);
  const [displayPoints, setDisplayPoints] = useState(0);

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [onlineStep, setOnlineStep] = useState("methods"); // methods, bKash, nagad, rocket
  const [walletNumber, setWalletNumber] = useState("");

  const handlePaymentSubmit = async (rideId, method) => {
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          paymentStatus: "paid",
          paymentMethod: method 
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRide(prev => ({ ...prev, paymentStatus: 'paid', paymentMethod: method }));
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setOnlineStep("methods");
        setWalletNumber("");
      } else {
        alert(`Payment error: ${data.error}`);
      }
    } catch (err) {
      alert(`Payment error: ${err.message}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchRide = async () => {
      try {
        const res = await fetch(`/api/rides/${id}`);
        const data = await res.json();
        
        if (data.success) {
          setRide(data.data);
        } else {
          setError(data.error || 'Failed to load ride data');
        }
      } catch (err) {
        setError('Error connecting to server');
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [id]);

  useEffect(() => {
    if (!ride) return;

    // Calculations based on the provided formulas
    const distance = ride.distanceKm || 0;
    const passengers = ride.seats || 1;
    
    // Money saved = total fare - per person fare
    const perPersonFare = ride.fare || 0;
    const totalFare = perPersonFare * passengers;
    const moneySaved = totalFare - perPersonFare;
    
    // CO2 Emission (g) = Distance (km) * Emission Factor (150g/km) * no of passengers (If solo)
    const emissionSolo = distance * 150 * passengers;
    
    // CO2 Emission after sharing ride (g) = (Distance (km) * Emission Factor (150g/km)) / no of passengers
    const emissionShared = (distance * 150) / passengers;
    
    // Reduced Carbon Emission (g) = CO2 Emission (g) - CO2 Emission after sharing ride (g)
    const reducedEmission = emissionSolo - emissionShared;
    
    // Points = 1 point per 150 grams CO2 saved
    const points = Math.floor(reducedEmission / 150);

    // Animation logic for numbers
    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Ease out quad
      const easeProgress = progress * (2 - progress);
      
      setDisplayKm(distance * easeProgress);
      setDisplayMoney(moneySaved * easeProgress);
      setDisplayCo2(reducedEmission * easeProgress);
      setDisplayPoints(points * easeProgress);

      if (currentStep >= steps) {
        clearInterval(timer);
        setDisplayKm(distance);
        setDisplayMoney(moneySaved);
        setDisplayCo2(reducedEmission);
        setDisplayPoints(points);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [ride]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 border-solid"></div>
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-md text-center max-w-md w-full border border-red-100">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-6">{error || 'Ride not found'}</p>
            <Link href="/Dashboard" className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col items-center p-4 py-10">
        
        {/* Success Header Banner */}
        <div className="w-full max-w-5xl bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg p-8 mb-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path></svg>
          </div>
          <div className="relative z-10">
            <div className="inline-block bg-white/20 p-3 rounded-full mb-4 backdrop-blur-sm border border-white/30">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-3xl font-extrabold mb-2">Ride Ended Successfully!</h1>
            <p className="text-lg text-green-50 max-w-2xl mx-auto">
              You shared your {ride.distanceKm} km commute from {ride.origin.split(',')[0]} to {ride.destination.split(',')[0]}. Check out the positive impact you've made!
            </p>
          </div>
        </div>

        {/* Payment Required Alert */}
        {ride.paymentStatus !== 'paid' && (
          <div className="w-full max-w-5xl bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 text-orange-600 p-3 rounded-full text-2xl">
                💰
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-gray-800">Payment Pending</h3>
                <p className="text-gray-600">Please complete the payment of ৳{ride.fare} for this ride.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 px-10 rounded-xl shadow-lg transition transform hover:scale-105 active:scale-95"
            >
              PAY NOW
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Money Saved Card */}
          <div className="bg-white rounded-2xl shadow-md p-6 border-b-4 border-yellow-400 transform transition duration-500 hover:scale-105 hover:shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-yellow-100 p-3 rounded-xl text-yellow-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <span className="text-xs font-bold text-yellow-500 bg-yellow-50 px-2 py-1 rounded-full uppercase tracking-wider">Financial</span>
            </div>
            <h3 className="text-gray-500 font-medium text-sm mb-1">Potential Money Saved</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">৳{Math.round(displayMoney).toLocaleString()}</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (displayMoney / 500) * 100)}%`, transition: 'width 2s ease-out' }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">By sharing your fuel costs with {ride.seats} passengers</p>
          </div>

          {/* CO2 Card */}
          <div className="bg-white rounded-2xl shadow-md p-6 border-b-4 border-green-500 transform transition duration-500 hover:scale-105 hover:shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-green-100 p-3 rounded-xl text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full uppercase tracking-wider">Environment</span>
            </div>
            <h3 className="text-gray-500 font-medium text-sm mb-1">CO₂ Emission Reduced</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">{(displayCo2 / 1000).toFixed(2)}</span>
              <span className="text-lg font-bold text-gray-500">kg</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (displayCo2 / 5000) * 100)}%`, transition: 'width 2s ease-out' }}></div>
            </div>
            <p className="text-xs text-green-600 font-medium mt-2">≈ Equivalent to planting {(displayCo2 / 21000).toFixed(2)} trees 🌳</p>
          </div>

          {/* Points Card */}
          <div className="bg-white rounded-2xl shadow-md p-6 border-b-4 border-blue-500 transform transition duration-500 hover:scale-105 hover:shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
              </div>
              <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Rewards</span>
            </div>
            <h3 className="text-gray-500 font-medium text-sm mb-1">Impact Points Earned</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-blue-600">+{Math.round(displayPoints)}</span>
              <span className="text-lg font-bold text-gray-500">pts</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (displayPoints / 50) * 100)}%`, transition: 'width 2s ease-out' }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Added to your Profile Dashboard!</p>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link href="/Dashboard" className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm">
            Go to Dashboard
          </Link>
          <Link href="/profile" className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-md flex items-center gap-2">
            View My Profile <span className="text-xl">➔</span>
          </Link>
        </div>

      </div>

      {/* Payment Modal */}
      {showPaymentModal && ride && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-300">
            {/* Header */}
            <div className={`p-6 text-white text-center transition-colors duration-500 ${
              onlineStep === "bKash" ? "bg-[#D12053]" : 
              onlineStep === "nagad" ? "bg-[#F7941D]" : 
              onlineStep === "rocket" ? "bg-[#8C3494]" : "bg-gradient-to-r from-orange-500 to-orange-600"
            }`}>
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                {onlineStep === "methods" ? "💰" : "📱"}
              </div>
              <h2 className="text-2xl font-bold">
                {onlineStep === "methods" ? "Ride Payment" : 
                 onlineStep === "bKash" ? "bKash Payment" :
                 onlineStep === "nagad" ? "Nagad Payment" : "Rocket Payment"}
              </h2>
              <p className="opacity-90">Total Fare to Pay</p>
              <div className="text-4xl font-extrabold mt-1">৳{ride.fare}</div>
            </div>

            <div className="p-6 space-y-6">
              {onlineStep === "methods" ? (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Route</span>
                      <span className="font-semibold text-gray-800">{ride.origin.split(',')[0]} → {ride.destination.split(',')[0]}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Driver</span>
                      <span className="font-semibold text-gray-800">{ride.driverName}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">Choose Payment Method</p>
                    
                    <button
                      onClick={() => handlePaymentSubmit(ride._id, "cash")}
                      disabled={paymentLoading}
                      className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition group"
                    >
                      <div className="bg-green-100 text-green-600 w-12 h-12 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition">
                        💵
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-gray-800">Cash Payment</div>
                        <div className="text-xs text-gray-500">Pay directly to the driver</div>
                      </div>
                    </button>

                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setOnlineStep("bKash")}
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
                </>
              ) : (
                /* Digital Wallet Step */
                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter {onlineStep.charAt(0).toUpperCase() + onlineStep.slice(1)} Number
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
                      onClick={() => handlePaymentSubmit(ride._id, onlineStep)}
                      disabled={paymentLoading || walletNumber.length < 10}
                      className={`w-full py-4 rounded-xl text-white font-bold shadow-lg transition active:scale-95 disabled:opacity-50 ${
                        onlineStep === "bKash" ? "bg-[#D12053] hover:bg-[#B01B46]" : 
                        onlineStep === "nagad" ? "bg-[#F7941D] hover:bg-[#E0851A]" : 
                        "bg-[#8C3494] hover:bg-[#762C7D]"
                      }`}
                    >
                      {paymentLoading ? "Processing..." : `Pay ৳${ride.fare} Now`}
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
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setOnlineStep("methods");
                  setWalletNumber("");
                }}
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
              Your payment is received
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
    </div>
  );
}
