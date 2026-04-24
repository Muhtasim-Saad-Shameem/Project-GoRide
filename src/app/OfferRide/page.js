'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Script from 'next/script';
import Link from 'next/link';
import PreferencesModal from '@/components/PreferencesModal';
import { preferenceOptions, nameToOption } from '@/lib/preferenceOptions';
import { departments, buildings } from '@/lib/campusOptions';
import { registerFCM } from '@/lib/registerFCM';

const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
});


const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const isLikelyGoogleMapsKey = (key) => /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
const hasGoogleMapsKey = isLikelyGoogleMapsKey(mapsApiKey);
const hasInvalidGoogleMapsKey = Boolean(mapsApiKey) && !hasGoogleMapsKey;

export default function GoRidePage() {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    date: '',
    availableSeats: '',
    startTime: '',
    endTime: '',
    vehicleType: '',
    fare: '',
    department: '',
    buildingName: '',
  });

  // preferences state and modal visibility
  const [preferences, setPreferences] = useState([]);
  const [showPrefsModal, setShowPrefsModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Google Maps State
  const [map, setMap] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [travelInfo, setTravelInfo] = useState(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);

  useEffect(() => {
    if (hasInvalidGoogleMapsKey) {
      setMessage('Google Maps key is invalid. Use a valid NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local.');
      return;
    }

    if (!hasGoogleMapsKey) {
      setMessage('Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local.');
    }

    registerFCM().catch((err) => console.error('OfferRide FCM registration failed:', err));
  }, []);

  useEffect(() => {
    return () => {
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }

      if (typeof window !== 'undefined' && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(originInputRef.current);
        window.google.maps.event.clearInstanceListeners(destinationInputRef.current);
      }
    };
  }, [directionsRenderer]);

  // Fare calculation state
  const [fareData, setFareData] = useState(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear fare data if origin/destination/vehicle/seats change
    if (['origin', 'destination', 'vehicleType', 'availableSeats'].includes(name)) {
      setFareData(null);
      setFareError('');
    }
  };

  const handleCalculateFare = async () => {
    if (!formData.origin || !formData.destination) {
      setFareError('Please enter both origin and destination');
      return;
    }
    if (!formData.vehicleType) {
      setFareError('Please select a vehicle type');
      return;
    }
    if (!formData.availableSeats) {
      setFareError('Please select available seats');
      return;
    }

    setFareLoading(true);
    setFareError('');
    setFareData(null);

    try {
      const res = await fetch(
        `/api/distance?origin=${encodeURIComponent(formData.origin)}&destination=${encodeURIComponent(formData.destination)}`
      );
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to calculate distance');
      }

      setFareData(data);

      // Auto-fill the total fuel cost
      const vehicleCosts = data.fuelCosts[formData.vehicleType];
      if (vehicleCosts) {
        setFormData(prev => ({ ...prev, fare: vehicleCosts.total.toString() }));
      }
    } catch (err) {
      setFareError(err.message);
    } finally {
      setFareLoading(false);
    }
  };

  const handlePreferences = () => {
    setShowPrefsModal(true);
  };

  const initMap = () => {
    if (typeof window !== 'undefined' && window.google && !map) {
      const google = window.google;
      
      const newMap = new google.maps.Map(mapRef.current, {
        center: { lat: 23.8103, lng: 90.4125 }, // Dhaka coordinates
        zoom: 12,
        mapTypeControl: false,
      });

      const newRenderer = new google.maps.DirectionsRenderer();
      newRenderer.setMap(newMap);
      
      const newService = new google.maps.DirectionsService();

      setMap(newMap);
      setDirectionsRenderer(newRenderer);
      setDirectionsService(newService);

      // Autocomplete setup
      const originAutocomplete = new google.maps.places.Autocomplete(originInputRef.current);
      const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInputRef.current);

      originAutocomplete.addListener('place_changed', () => {
        const place = originAutocomplete.getPlace();
        if (place.formatted_address) {
          setFormData(prev => ({ ...prev, origin: place.formatted_address }));
        }
      });

      destinationAutocomplete.addListener('place_changed', () => {
        const place = destinationAutocomplete.getPlace();
        if (place.formatted_address) {
          setFormData(prev => ({ ...prev, destination: place.formatted_address }));
        }
      });
      
      setIsApiLoaded(true);
    }
  };

  const handleShowRoute = () => {
    if (!formData.origin || !formData.destination) {
      alert('Please enter both origin and destination');
      return;
    }

    if (!directionsService || !directionsRenderer) {
      alert('Google Maps API is still loading...');
      return;
    }

    directionsService.route(
      {
        origin: formData.origin,
        destination: formData.destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          
          const route = result.routes[0].legs[0];
          setTravelInfo({
            distance: route.distance.text,
            duration: route.duration.text,
            durationInTraffic: route.duration_in_traffic ? route.duration_in_traffic.text : null,
          });
        } else {
          alert('Could not find route: ' + status);
        }
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.origin || !formData.destination || !formData.date || !formData.availableSeats || !formData.startTime || !formData.endTime || !formData.vehicleType) {
      setMessage('Please fill in all fields');
      return;
    }

    if (fareData && formData.vehicleType && fareData.fuelCosts[formData.vehicleType]) {
      const suggestedTotalFare = fareData.fuelCosts[formData.vehicleType].total;
      const minFare = Math.max(0, suggestedTotalFare - 30);
      if (formData.fare !== '' && parseFloat(formData.fare) < minFare) {
        setMessage(`Error: Minimum fare you can offer for this ride is ৳${minFare}`);
        return;
      }
    }

    setLoading(true);
    setMessage('');

    try {
      const totalFareInput = parseInt(formData.fare);
      const seatsCount = parseInt(formData.availableSeats);
      const perPersonFare = !isNaN(totalFareInput) && !isNaN(seatsCount) && seatsCount > 0 
        ? Math.ceil(totalFareInput / seatsCount) 
        : 0;

      const submitData = {
        ...formData,
        fare: perPersonFare, // Save as per-person fare in the database
        preferences,
        ...(fareData && {
          distanceKm: fareData.distance_km,
          duration: fareData.duration_text,
        }),
      };

      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();
      console.log('Response from server:', data);
      if (!data.success) {
        throw new Error(data.message || 'Failed to create ride');
      }

      setMessage('Ride offered successfully! Redirecting to impact dashboard...');
      setTimeout(() => {
        window.location.href = `/impact/${data.data._id}`;
      }, 1000);
      setMessage('Ride offered successfully!');
      setFormData({
        origin: '',
        destination: '',
        date: '',
        availableSeats: '',
        startTime: '',
        endTime: '',
        vehicleType: '',
        department: '',
        buildingName: '',
      });
      if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
      }
      setTravelInfo(null);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const suggestedTotalFare = fareData && formData.vehicleType && fareData.fuelCosts[formData.vehicleType] 
    ? fareData.fuelCosts[formData.vehicleType].total 
    : 0;
  const minFare = Math.max(0, suggestedTotalFare - 30);
  const currentInputFare = parseFloat(formData.fare);
  const isUnderPriced = !isNaN(currentInputFare) && currentInputFare < minFare;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      {hasGoogleMapsKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places`}
          onLoad={initMap}
          onError={() => setMessage('Failed to load Google Maps. Check your API key and restrictions.')}
        />
      )}
      <div className="flex-1 flex flex-col items-center p-4">
      {/* Main card */}
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 text-white py-4 px-6">
          <h1 className="text-2xl font-bold">GoRide</h1>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Left Column: Form */}
          <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Offer A Ride</h2>
            <p className="text-gray-600 mb-6">Share your commute with fellow students</p>

          {/* Message Display */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Starting point */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starting Point (Origin)
              </label>
              <input
                ref={originInputRef}
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleInputChange}
                placeholder="eg. Banani, 11/A Main St. Or BRAC University"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 text-gray-900"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination
              </label>
              <input
                ref={destinationInputRef}
                type="text"
                name="destination"
                value={formData.destination}
                onChange={handleInputChange}
                placeholder="eg. Gulshan, 11/A Main St. Or BRAC University"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 text-gray-900"
              />
            </div>

            {/* Date and Seats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
                <select 
                  name="availableSeats"
                  value={formData.availableSeats}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white">
                  <option value="">Select seats</option>
                  <option value="1">1 seat</option>
                  <option value="2">2 seats</option>
                  <option value="3">3 seats</option>
                  <option value="4">4 seats</option>
                  <option value="5">5+ seats</option>
                </select>
              </div>
            </div>

            {/* Time row - Time pickers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                  />
                </div>
                <span className="text-gray-500 font-medium">to</span>
                <div className="flex-1">
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Select start and end time</p>
            </div>

            {/* Types of Vehicle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Types of Vehicle</label>
              <select 
                name="vehicleType"
                value={formData.vehicleType}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white">
                <option value="">Select vehicle type</option>
                <option value="Car">Car</option>
                <option value="Micro">Micro</option>
                <option value="Bike">Bike</option>
              </select>
            </div>
            {/* Department & Building (optional – helps students find this ride) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white text-sm"
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campus Building <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  name="buildingName"
                  value={formData.buildingName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 bg-white text-sm"
                >
                  <option value="">Select building</option>
                  {buildings.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preferences and Calculate Fare buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button 
                type="button"
                onClick={handlePreferences}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
              >
                Preferences
              </button>
              <button 
                type="button"
                onClick={handleCalculateFare}
                disabled={fareLoading}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition duration-200 flex items-center gap-2"
              >
                {fareLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculating...
                  </>
                ) : 'Calculate Fare'}
              </button>
              <button 
                type="button"
                onClick={handleShowRoute}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
              >
                Show Fastest Route
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
              >
                {loading ? 'Submitting...' : 'Offer Ride'}
              </button>
            </div>

            {/* Fare Error */}
            {fareError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                ⚠️ {fareError}
              </div>
            )}

            {/* Fare Breakdown Card */}
            {fareData && (
              <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 animate-in slide-in-from-top" style={{ animation: 'slideDown 0.3s ease-out' }}>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                  Route Details
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Distance</p>
                    <p className="text-xl font-bold text-gray-900">{fareData.distance_text}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Est. Travel Time</p>
                    <p className="text-xl font-bold text-gray-900">{fareData.duration_text}</p>
                  </div>
                </div>

                {formData.vehicleType && fareData.fuelCosts[formData.vehicleType] && (
                  <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">Total fuel cost ({formData.vehicleType})</p>
                      <p className="text-lg font-bold text-gray-800">৳{fareData.fuelCosts[formData.vehicleType].total}</p>
                    </div>
                    <div className="border-t border-green-100 pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700">Suggested per-person share</p>
                          <p className="text-xs text-gray-500">{formData.availableSeats} seat{formData.availableSeats !== '1' ? 's' : ''}</p>
                        </div>
                        <p className="text-2xl font-extrabold text-green-600">
                          ৳{fareData.fuelCosts[formData.vehicleType].perSeat[formData.availableSeats] || fareData.fuelCosts[formData.vehicleType].perSeat['1']}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Fuel Cost (Editable)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-600">৳</span>
                    <input
                      type="number"
                      name="fare"
                      value={formData.fare}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="Adjust fare if needed"
                      className={`flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 font-semibold ${
                        isUnderPriced ? 'border-red-500 text-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500 text-gray-900'
                      }`}
                    />
                  </div>
                  {isUnderPriced ? (
                    <p className="text-sm text-red-500 mt-1 font-medium">Minimum fare you can offer for this ride is ৳{minFare}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">You can adjust the suggested fare before submitting</p>
                  )}
                </div>
              </div>
            )}
            {/* preferences alert display as badges */}
            {preferences.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {preferences.map((name) => {
                  const opt = nameToOption[name];
                  if (!opt) return null;
                  const colorMap = {
                    pink: 'bg-pink-100 text-pink-800',
                    gray: 'bg-gray-100 text-gray-800',
                    blue: 'bg-blue-100 text-blue-800',
                    purple: 'bg-purple-100 text-purple-800',
                    yellow: 'bg-yellow-100 text-yellow-800',
                    orange: 'bg-orange-100 text-orange-800',
                    cyan: 'bg-cyan-100 text-cyan-800',
                    green: 'bg-green-100 text-green-800',
                  };
                  const clz = colorMap[opt.color] || colorMap.gray;
                  return (
                    <span
                      key={name}
                      className={`${clz} px-2 py-1 text-xs rounded-full`}
                    >
                      {opt.label}
                    </span>
                  );
                })}
              </div>
            )}
          </form>

          {/* Map and Route Info */}
          <div className="mt-8 space-y-4">
            {travelInfo && (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex flex-wrap gap-6 justify-around text-indigo-900 font-medium">
                <div>Distance: <span className="font-bold">{travelInfo.distance}</span></div>
                <div>Est. Time: <span className="font-bold">{travelInfo.duration}</span></div>
                {travelInfo.durationInTraffic && (
                  <div>With Traffic: <span className="font-bold text-red-600">{travelInfo.durationInTraffic}</span></div>
                )}
              </div>
            )}
            <div className="relative w-full h-96 rounded-xl border-2 border-gray-200 shadow-inner overflow-hidden" style={{ minHeight: '400px' }}>
              <div
                ref={mapRef}
                className="w-full h-full"
              />
              {!isApiLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
                  Loading Google Maps...
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 italic text-center">
              Routes are calculated based on current Dhaka traffic conditions.
            </p>
          </div>
        </div>

        {/* Right Column: Map */}
        <div className="w-full md:w-1/2 bg-gray-50 min-h-[400px] relative">
          <div className="sticky top-0 h-full w-full min-h-[400px] md:h-screen md:max-h-[800px]">
            <RouteMap fareData={fareData} />
          </div>
        </div>
      </div>


        {/* Footer navigation (Home, Class Schedule, Contact Us) */}
        <div className="border-t border-gray-200 bg-gray-50 py-3 px-6">
          <div className="flex justify-center space-x-8 text-gray-700 font-medium">
            <Link href="/" className="cursor-pointer hover:text-green-600">Home</Link>
            <Link href="/ClassSchedule" className="cursor-pointer hover:text-green-600">Class Schedule</Link>
            <span className="cursor-pointer hover:text-green-600">Contact Us</span>
          </div>
      </div>
        </div>
      </div>
    </div>
  );
}
