"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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

const STATUS_LABELS = {
  active: "Active",
  waiting: "Waiting",
  "en-route": "En Route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700",
  waiting: "bg-yellow-100 text-yellow-700",
  "en-route": "bg-blue-100 text-blue-700",
  arrived: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function ChatPopup() {
  const [open, setOpen] = useState(false);
  const [rides, setRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("rider");
  const [nameSet, setNameSet] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const currentRideRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("goride_chat_name");
    const savedRole = localStorage.getItem("goride_chat_role");
    if (saved) {
      setUserName(saved);
      setNameSet(true);
    }
    if (savedRole) setUserRole(savedRole);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("new-message", (msg) => {
      if (currentRideRef.current && msg.rideId === currentRideRef.current._id) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      } else if (!open) {
        setUnread((u) => u + 1);
      }
    });

    socket.on("ride-status-changed", (data) => {
      setRides((prev) =>
        prev.map((r) =>
          r._id === data.rideId ? { ...r, status: data.status } : r,
        ),
      );
    });

    const handleOpenGlobalChat = () => setOpen(true);
    window.addEventListener("open-global-chat", handleOpenGlobalChat);

    return () => {
      window.removeEventListener("open-global-chat", handleOpenGlobalChat);
      socket.off("new-message");
      socket.off("ride-status-changed");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      fetchRides();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchRides = async () => {
    try {
      const res = await fetch("/api/rides");
      const data = await res.json();
      if (data.success) setRides(data.data);
    } catch (error) {
      console.error("Fetch rides error:", error);
    }
  };

  const openRideChat = useCallback(async (ride) => {
    setSelectedRide(ride);
    currentRideRef.current = ride;
    setMessages([]);

    socketRef.current?.emit("join-ride", ride._id);

    try {
      const res = await fetch(`/api/messages?rideId=${ride._id}`);
      const data = await res.json();
      if (data.success) setMessages(data.data);
    } catch (error) {
      console.error("Load messages error:", error);
    }
  }, []);

  const leaveRideChat = () => {
    if (selectedRide) {
      socketRef.current?.emit("leave-ride", selectedRide._id);
    }
    setSelectedRide(null);
    currentRideRef.current = null;
    setMessages([]);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedRide || !userName) return;
    setSending(true);

    const payload = {
      rideId: selectedRide._id,
      senderName: userName,
      senderRole: userRole,
      content: inputText.trim(),
    };

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const saved = data.data;
        setMessages((prev) => [...prev, saved]);
        socketRef.current?.emit("send-message", saved);
        setInputText("");
      }
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const saveName = () => {
    if (!userName.trim()) return;
    localStorage.setItem("goride_chat_name", userName.trim());
    localStorage.setItem("goride_chat_role", userRole);
    setUserName(userName.trim());
    setNameSet(true);
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-28 right-6 z-[60] bg-green-600 hover:bg-green-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-110"
        title="GoRide Chat"
      >
        <span className="text-2xl">{open ? "✕" : "💬"}</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-32 right-6 z-[60] w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: "520px" }}
        >
          <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="text-xl">💬</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">GoRide Chat</p>
              <p className="text-green-200 text-xs flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-green-300" : "bg-red-400"}`}
                />
                {connected ? "Connected" : "Connecting..."}
              </p>
            </div>
            {selectedRide && (
              <button
                onClick={leaveRideChat}
                className="text-green-200 hover:text-white text-sm px-2 py-1 rounded transition"
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-green-200 hover:text-white ml-1"
            >
              ✕
            </button>
          </div>

          {!nameSet ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 bg-gray-50">
              <div className="text-4xl mb-4">👤</div>
              <p className="text-gray-700 font-semibold text-center mb-1">
                Welcome to GoRide Chat
              </p>
              <p className="text-gray-400 text-sm text-center mb-5">
                Enter your name to start chatting with riders and drivers
              </p>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                placeholder="Your name..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
              />
              <div className="flex gap-2 w-full mb-4">
                <button
                  onClick={() => setUserRole("rider")}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition ${
                    userRole === "rider"
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-300 text-gray-600 hover:border-green-400"
                  }`}
                >
                  🙋 Rider
                </button>
                <button
                  onClick={() => setUserRole("driver")}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition ${
                    userRole === "driver"
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-300 text-gray-600 hover:border-green-400"
                  }`}
                >
                  🚗 Driver
                </button>
              </div>
              <button
                onClick={saveName}
                disabled={!userName.trim()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition"
              >
                Start Chatting →
              </button>
            </div>
          ) : selectedRide ? (
            <>
              <div className="px-4 py-2 bg-green-50 border-b border-green-100 shrink-0">
                <p className="text-xs font-semibold text-green-800 truncate">
                  🚗 {selectedRide.origin} → {selectedRide.destination}
                </p>
                <p className="text-xs text-green-600">
                  {selectedRide.driverName} · {new Date(selectedRide.date).toLocaleDateString()}
                  &nbsp;·&nbsp;
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs ${
                      STATUS_COLORS[selectedRide.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {STATUS_LABELS[selectedRide.status] || selectedRide.status}
                  </span>
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    <p className="text-2xl mb-2">👋</p>
                    No messages yet. Say hello!
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.senderName === userName;
                  return (
                    <div
                      key={msg._id || i}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      {!isMe && (
                        <span className="text-xs text-gray-400 mb-0.5 px-1">
                          {msg.senderName} {msg.senderRole === "driver" ? "🚗" : "🙋"}
                        </span>
                      )}
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                          isMe
                            ? "bg-green-600 text-white rounded-br-sm"
                            : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-xs"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-xs text-gray-400 mt-0.5 px-1">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-3 py-3 border-t border-gray-200 bg-white shrink-0 flex gap-2 items-end">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 border border-gray-300 rounded-2xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  style={{ maxHeight: "80px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 transition"
                >
                  ➤
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Active Rides
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    Chatting as <strong className="text-gray-700">{userName}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setNameSet(false);
                      setUserName("");
                    }}
                    className="text-xs text-green-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>

              {rides.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                  <span className="text-3xl mb-2">🚗</span>
                  No active rides found.
                </div>
              ) : (
                rides.map((ride) => (
                  <button
                    key={ride._id}
                    onClick={() => openRideChat(ride)}
                    className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 transition flex items-center gap-3"
                  >
                    <div className="bg-green-100 rounded-full w-10 h-10 flex items-center justify-center text-xl shrink-0">
                      🚗
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {ride.origin} → {ride.destination}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {ride.driverName} · {new Date(ride.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        STATUS_COLORS[ride.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[ride.status] || ride.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
