const socket = io();

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => { //position me info hai
      const { latitude, longitude } = position.coords; // info extract kr rhe hai
      socket.emit("send-location", { latitude, longitude }); // abckend pr bhej rhe hai
    },
    (error) => {
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    }
  );
}

const map = L.map("map").setView([0, 0], 18); //middle of earth ko magnify krke dikha rha hai

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map); // ye tiles wala view add krega

const markers = {};

socket.on("location-recieved", (data) => {
  const { id, latitude, longitude } = data;
  map.setView([latitude, longitude]); // this will show your location

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
  } else {
    markers[id] = L.marker([latitude, longitude]).addTo(map);
  }
});

socket.on("user disconnected:", () => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});
