const express = require("express");
const http = require("http");
const path = require("path");
const socket = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Color palette for user markers
const AVATAR_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#EF4444", // Red
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#6366F1"  // Indigo
];

// Active users registry: socketId -> userData
const users = {};

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // User joins a room with custom username
  socket.on("join-room", (payload) => {
    const room = (payload && payload.room ? String(payload.room).trim() : "global") || "global";
    const username = (payload && payload.username ? String(payload.username).trim() : "") || `Guest_${socket.id.slice(0, 4)}`;
    const color = (payload && payload.color) || getRandomColor();

    socket.join(room);

    users[socket.id] = {
      id: socket.id,
      username,
      room,
      color,
      isSharing: true,
      latitude: null,
      longitude: null,
      accuracy: null,
      speed: null,
      heading: null,
      lastUpdated: Date.now()
    };

    // Send the joining user their assigned info
    socket.emit("registered", {
      id: socket.id,
      username,
      room,
      color
    });

    // Send existing users in the room who already shared their location
    const existingUsers = Object.values(users).filter(
      (u) => u.room === room && u.id !== socket.id && u.latitude !== null
    );
    socket.emit("initial-users", existingUsers);

    // Notify others in room
    socket.to(room).emit("user-joined", {
      id: socket.id,
      username,
      color
    });

    // Send updated user count to room
    const roomCount = Object.values(users).filter((u) => u.room === room).length;
    io.to(room).emit("room-user-count", { count: roomCount, room });
  });

  // Handle location update
  socket.on("send-location", (data) => {
    const user = users[socket.id];
    if (!user) return;

    user.latitude = data.latitude;
    user.longitude = data.longitude;
    user.accuracy = data.accuracy ?? null;
    user.speed = data.speed ?? null;
    user.heading = data.heading ?? null;
    user.lastUpdated = Date.now();

    // Broadcast updated location to everyone in the room
    io.to(user.room).emit("location-received", {
      id: socket.id,
      username: user.username,
      color: user.color,
      isSharing: user.isSharing,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: user.accuracy,
      speed: user.speed,
      heading: user.heading,
      lastUpdated: user.lastUpdated
    });
  });

  // Handle toggle sharing (pause / resume)
  socket.on("toggle-sharing", (data) => {
    const user = users[socket.id];
    if (!user) return;

    user.isSharing = Boolean(data && data.isSharing);
    io.to(user.room).emit("user-status-changed", {
      id: socket.id,
      isSharing: user.isSharing
    });
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const room = user.room;
      delete users[socket.id];

      io.to(room).emit("user-disconnected", socket.id);

      const roomCount = Object.values(users).filter((u) => u.room === room).length;
      io.to(room).emit("room-user-count", { count: roomCount, room });
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`⚡ Realtime Tracker Server running at http://localhost:${PORT}`);
});
