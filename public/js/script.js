/**
 * GeoPulse | Live Realtime Tracker Engine
 * Features: Rooms, Telemetry, Breadcrumb Trails, Dynamic Pulse Markers & Multi-Layer Maps
 */

// ==========================================================================
// 1. State & Configurations
// ==========================================================================

const AVATAR_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", 
  "#F59E0B", "#06B6D4", "#EF4444", "#14B8A6", 
  "#F97316", "#6366F1"
];

// Parse URL params for room
const urlParams = new URLSearchParams(window.location.search);
let currentRoom = (urlParams.get("room") || "global").toLowerCase();
let myUsername = localStorage.getItem("geopulse_username") || "";
let myColor = localStorage.getItem("geopulse_color") || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
let isSharing = true;

// Trackers dictionary: socketId -> { marker, circle, polyline, history: [], data }
const peers = {};
let myLocation = null;
let hasCenteredInitially = false;

// ==========================================================================
// 2. Map & Layers Setup
// ==========================================================================

const tileLayers = {
  dark: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "dark-matter-tiles",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }),
  streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }),
  satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: '&copy; Esri &mdash; Earthstar Geographics'
  })
};

// Initialize map with Dark Matter
const map = L.map("map", {
  zoomControl: false,
  layers: [tileLayers.dark]
}).setView([20, 0], 2);

// Re-position zoom controls to bottom-right
L.control.zoom({ position: "bottomright" }).addTo(map);

// Polyline trail layer group
const trailsGroup = L.layerGroup().addTo(map);

// ==========================================================================
// 3. Socket.IO Connection & Events
// ==========================================================================

const socket = io();

// UI Elements
const connectionStatus = document.getElementById("connectionStatus");
const roomNameLabel = document.getElementById("roomNameLabel");
const onlineCountLabel = document.getElementById("onlineCountLabel");
const myUsernameDisplay = document.getElementById("myUsernameDisplay");
const myAvatarBadge = document.getElementById("myAvatarBadge");
const mySharingStatus = document.getElementById("mySharingStatus");
const metricSpeed = document.getElementById("metricSpeed");
const metricAccuracy = document.getElementById("metricAccuracy");
const metricCoords = document.getElementById("metricCoords");
const peersList = document.getElementById("peersList");
const peersCountBadge = document.getElementById("peersCountBadge");
const toastContainer = document.getElementById("toastContainer");

// Status Helpers
function setOnlineStatus(isOnline, text = "Connected") {
  if (isOnline) {
    connectionStatus.className = "status-indicator online";
    connectionStatus.innerHTML = `<span class="status-dot"></span><span class="status-text">${text}</span>`;
  } else {
    connectionStatus.className = "status-indicator offline";
    connectionStatus.innerHTML = `<span class="status-dot"></span><span class="status-text">${text}</span>`;
  }
}

// Socket Lifecycle
socket.on("connect", () => {
  setOnlineStatus(true, "Live");
  showToast("Connected to GeoPulse Grid", "fa-satellite");

  // Automatically join if we already have a saved username
  if (myUsername) {
    joinRoomSession(myUsername, currentRoom, myColor);
  } else {
    openJoinModal();
  }
});

socket.on("disconnect", () => {
  setOnlineStatus(false, "Disconnected");
  showToast("Connection lost. Reconnecting...", "fa-triangle-exclamation");
});

socket.on("registered", (data) => {
  myUsername = data.username;
  myColor = data.color;
  currentRoom = data.room;

  localStorage.setItem("geopulse_username", myUsername);
  localStorage.setItem("geopulse_color", myColor);

  updateSelfBadge();
});

socket.on("initial-users", (existingUsers) => {
  existingUsers.forEach((user) => {
    updatePeerPosition(user);
  });
  renderPeersList();
});

socket.on("user-joined", (data) => {
  showToast(`${data.username} entered radar grid`, "fa-user-plus");
});

socket.on("location-received", (data) => {
  if (data.id === socket.id) {
    // Current user's confirmed position
    updateSelfTelemetry(data);
    if (!hasCenteredInitially) {
      map.setView([data.latitude, data.longitude], 16, { animate: true });
      hasCenteredInitially = true;
    }
  }

  // Update or create marker on map
  updatePeerPosition(data);
  renderPeersList();
});

socket.on("user-status-changed", ({ id, isSharing }) => {
  if (peers[id]) {
    peers[id].data.isSharing = isSharing;
    if (peers[id].marker) {
      const badge = peers[id].marker.getElement()?.querySelector(".radar-marker-badge");
      if (badge) {
        badge.className = `radar-marker-badge ${isSharing ? "" : "paused"}`;
      }
    }
    renderPeersList();
  }
});

socket.on("user-disconnected", (id) => {
  removePeer(id);
  renderPeersList();
});

socket.on("room-user-count", ({ count, room }) => {
  onlineCountLabel.textContent = `${count} Online`;
  peersCountBadge.textContent = count;
  roomNameLabel.textContent = `#${room}`;
});

// ==========================================================================
// 4. Geolocation Tracking Engine
// ==========================================================================

let watchId = null;

function startLocationWatching() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      myLocation = { latitude, longitude };

      if (isSharing) {
        socket.emit("send-location", {
          latitude,
          longitude,
          accuracy: accuracy ? Math.round(accuracy) : null,
          speed: speed !== null ? Math.round(speed * 3.6 * 10) / 10 : 0, // convert m/s to km/h
          heading: heading || 0
        });
      }
    },
    (err) => {
      console.warn("Geolocation watch error:", err.message);
      metricCoords.textContent = "GPS Unavailable";
      showToast("Location access denied or unavailable", "fa-triangle-exclamation");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

// ==========================================================================
// 5. Marker & Trail Rendering
// ==========================================================================

function createCustomMarkerIcon(username, color, isSelf = false) {
  const initials = (username || "??")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const html = `
    <div class="radar-marker-container">
      <div class="radar-marker-pulse" style="background-color: ${color};"></div>
      <div class="radar-marker-avatar" style="background-color: ${color};">
        ${isSelf ? "ME" : initials}
      </div>
      <div class="radar-marker-badge ${isSharing ? "" : "paused"}"></div>
    </div>
  `;

  return L.divIcon({
    className: "custom-radar-marker",
    html: html,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22]
  });
}

function updatePeerPosition(data) {
  const { id, username, color, latitude, longitude, accuracy, speed, isSharing: sharing } = data;
  const isSelf = id === socket.id;

  if (!peers[id]) {
    // New Peer Setup
    const icon = createCustomMarkerIcon(username, color, isSelf);
    const marker = L.marker([latitude, longitude], { icon }).addTo(map);

    // Trail polyline
    const polyline = L.polyline([[latitude, longitude]], {
      color: color,
      weight: 3,
      opacity: 0.65,
      dashArray: "6, 6"
    }).addTo(trailsGroup);

    // Accuracy Circle (only rendered for active location)
    let circle = null;
    if (isSelf && accuracy) {
      circle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        weight: 1
      }).addTo(map);
    }

    // Popup
    marker.bindPopup(buildPopupHtml(data, isSelf), { className: "custom-leaflet-popup" });

    peers[id] = {
      marker,
      circle,
      polyline,
      history: [[latitude, longitude]],
      data
    };
  } else {
    // Update Existing Peer
    const peer = peers[id];
    peer.data = data;

    // Smooth movement
    peer.marker.setLatLng([latitude, longitude]);
    peer.marker.setPopupContent(buildPopupHtml(data, isSelf));

    // Update trail
    peer.history.push([latitude, longitude]);
    if (peer.history.length > 30) peer.history.shift(); // Keep last 30 points
    peer.polyline.setLatLngs(peer.history);

    // Update accuracy circle
    if (peer.circle && accuracy) {
      peer.circle.setLatLng([latitude, longitude]);
      peer.circle.setRadius(accuracy);
    }
  }
}

function removePeer(id) {
  if (peers[id]) {
    map.removeLayer(peers[id].marker);
    trailsGroup.removeLayer(peers[id].polyline);
    if (peers[id].circle) map.removeLayer(peers[id].circle);
    delete peers[id];
  }
}

function buildPopupHtml(data, isSelf) {
  const name = isSelf ? `${data.username} (You)` : data.username;
  const speedStr = data.speed !== null ? `${data.speed} km/h` : "Stationary";
  const accStr = data.accuracy !== null ? `±${data.accuracy}m` : "Unknown";

  return `
    <div class="popup-user-card">
      <div class="popup-header">
        <div class="popup-avatar" style="background-color: ${data.color};">
          ${data.username.slice(0, 1).toUpperCase()}
        </div>
        <span class="popup-name">${escapeHtml(name)}</span>
      </div>
      <div class="popup-meta">
        <div><strong>Speed:</strong> ${speedStr}</div>
        <div><strong>Accuracy:</strong> ${accStr}</div>
      </div>
    </div>
  `;
}

// ==========================================================================
// 6. UI Updates & Telemetry Sync
// ==========================================================================

function updateSelfTelemetry(data) {
  metricSpeed.innerHTML = `${data.speed ?? "0.0"} <small>km/h</small>`;
  metricAccuracy.innerHTML = `${data.accuracy ?? "--"} <small>m</small>`;
  metricCoords.textContent = `${data.latitude.toFixed(5)}°, ${data.longitude.toFixed(5)}°`;
}

function updateSelfBadge() {
  myUsernameDisplay.textContent = myUsername;
  myAvatarBadge.textContent = myUsername.slice(0, 2).toUpperCase();
  myAvatarBadge.style.backgroundColor = myColor;
  roomNameLabel.textContent = `#${currentRoom}`;
}

function renderPeersList() {
  peersList.innerHTML = "";
  const peerKeys = Object.keys(peers);

  if (peerKeys.length === 0) {
    peersList.innerHTML = `<div style="font-size:12px; color:var(--text-dim); text-align:center; padding:12px;">No active trackers yet.</div>`;
    return;
  }

  peerKeys.forEach((id) => {
    const peer = peers[id];
    const isSelf = id === socket.id;
    const distanceText = isSelf
      ? "Your location"
      : myLocation
      ? `${formatDistance(calculateDistance(myLocation.latitude, myLocation.longitude, peer.data.latitude, peer.data.longitude))} away`
      : "Active";

    const item = document.createElement("div");
    item.className = "peer-item";
    item.innerHTML = `
      <div class="peer-info">
        <div class="peer-avatar" style="background-color: ${peer.data.color};">
          ${peer.data.username.slice(0, 2).toUpperCase()}
        </div>
        <div class="peer-meta">
          <span class="peer-name">${escapeHtml(peer.data.username)} ${isSelf ? "(You)" : ""}</span>
          <span class="peer-distance">${distanceText}</span>
        </div>
      </div>
      <button class="peer-locate-btn" title="Focus marker">
        <i class="fa-solid fa-crosshairs"></i>
      </button>
    `;

    // Click focus
    item.querySelector(".peer-locate-btn").addEventListener("click", () => {
      map.flyTo([peer.data.latitude, peer.data.longitude], 17, { duration: 1.2 });
      peer.marker.openPopup();
    });

    peersList.appendChild(item);
  });
}

// ==========================================================================
// 7. Distance & Math Utilities
// ==========================================================================

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ==========================================================================
// 8. Control Actions & Handlers
// ==========================================================================

// Recenter on self
document.getElementById("recenterBtn").addEventListener("click", () => {
  if (myLocation) {
    map.flyTo([myLocation.latitude, myLocation.longitude], 17, { duration: 1 });
  } else {
    showToast("Acquiring your location...", "fa-location-dot");
  }
});

// Fit all users
document.getElementById("fitAllBtn").addEventListener("click", () => {
  const allCoords = Object.values(peers).map((p) => [p.data.latitude, p.data.longitude]);
  if (allCoords.length > 0) {
    map.fitBounds(L.latLngBounds(allCoords), { padding: [60, 60], maxZoom: 17 });
  } else {
    showToast("No active users to fit", "fa-circle-info");
  }
});

// Toggle Sharing (Pause / Resume)
const toggleSharingBtn = document.getElementById("toggleSharingBtn");
toggleSharingBtn.addEventListener("click", () => {
  isSharing = !isSharing;

  if (isSharing) {
    toggleSharingBtn.className = "dock-btn active-sharing";
    toggleSharingBtn.querySelector(".dock-tooltip").textContent = "Broadcast On";
    mySharingStatus.className = "sharing-pill broadcasting";
    mySharingStatus.innerHTML = `<i class="fa-solid fa-circle-dot"></i> Live Broadcasting`;
    showToast("Location broadcast resumed", "fa-satellite-dish");
  } else {
    toggleSharingBtn.className = "dock-btn paused-sharing";
    toggleSharingBtn.querySelector(".dock-tooltip").textContent = "Broadcast Paused";
    mySharingStatus.className = "sharing-pill paused";
    mySharingStatus.innerHTML = `<i class="fa-solid fa-pause"></i> Broadcast Paused`;
    showToast("Location broadcast paused", "fa-pause");
  }

  socket.emit("toggle-sharing", { isSharing });
});

// Layer Switcher
const layerToggleBtn = document.getElementById("layerToggleBtn");
const layerMenu = document.getElementById("layerMenu");

layerToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  layerMenu.classList.toggle("show");
});

document.querySelectorAll(".layer-option").forEach((opt) => {
  opt.addEventListener("click", () => {
    document.querySelectorAll(".layer-option").forEach((o) => o.classList.remove("active"));
    opt.classList.add("active");

    const layerKey = opt.dataset.layer;
    Object.values(tileLayers).forEach((layer) => map.removeLayer(layer));
    tileLayers[layerKey].addTo(map);
    layerMenu.classList.remove("show");
  });
});

document.addEventListener("click", () => {
  layerMenu.classList.remove("show");
});

// Drawer Toggle
const telemetryDrawer = document.getElementById("telemetryDrawer");
const togglePanelBtn = document.getElementById("togglePanelBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");

togglePanelBtn.addEventListener("click", () => {
  telemetryDrawer.classList.toggle("open");
});

closeDrawerBtn.addEventListener("click", () => {
  telemetryDrawer.classList.remove("open");
});

// Copy Room Invite Link
document.getElementById("roomBadgeBtn").addEventListener("click", () => {
  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(currentRoom)}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast("Invite link copied to clipboard!", "fa-check");
  });
});

// ==========================================================================
// 9. Modal & Room Registration
// ==========================================================================

const joinModal = document.getElementById("joinModal");
const joinForm = document.getElementById("joinForm");
const usernameInput = document.getElementById("usernameInput");
const roomInput = document.getElementById("roomInput");
const colorPickerRow = document.getElementById("colorPickerRow");
let selectedModalColor = myColor;

function renderColorPicker() {
  colorPickerRow.innerHTML = "";
  AVATAR_COLORS.forEach((c) => {
    const dot = document.createElement("div");
    dot.className = `color-dot ${c === selectedModalColor ? "selected" : ""}`;
    dot.style.backgroundColor = c;
    dot.addEventListener("click", () => {
      selectedModalColor = c;
      renderColorPicker();
    });
    colorPickerRow.appendChild(dot);
  });
}

function openJoinModal() {
  usernameInput.value = myUsername || "";
  roomInput.value = currentRoom || "global";
  selectedModalColor = myColor;
  renderColorPicker();
  joinModal.classList.add("active");
}

function closeJoinModal() {
  joinModal.classList.remove("active");
}

document.getElementById("editUsernameBtn").addEventListener("click", openJoinModal);

document.getElementById("randomRoomBtn").addEventListener("click", () => {
  const words = ["alpha", "delta", "radar", "voyager", "tracker", "apex", "phoenix"];
  roomInput.value = `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(100 + Math.random() * 900)}`;
});

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = usernameInput.value.trim();
  const room = roomInput.value.trim() || "global";

  if (!name) return;

  myUsername = name;
  currentRoom = room;
  myColor = selectedModalColor;

  closeJoinModal();
  joinRoomSession(myUsername, currentRoom, myColor);

  // Update URL history without reload
  const newUrl = `${window.location.pathname}?room=${encodeURIComponent(currentRoom)}`;
  window.history.replaceState(null, "", newUrl);
});

function joinRoomSession(name, room, color) {
  socket.emit("join-room", { username: name, room: room, color: color });
  startLocationWatching();
}

// ==========================================================================
// 10. Toast Helper
// ==========================================================================

function showToast(message, icon = "fa-bell") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
