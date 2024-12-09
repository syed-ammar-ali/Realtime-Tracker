const express = require("express");
const http = require("http");
const path = require("path");
const socket = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("send-location", (data) => { //frontend se data recieve hoga
    io.emit("location-recieved", { //frontend pr data bhejega
      id: socket.id,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    // console.log(data);
  });
  socket.on("disconnect", () => { //frontend se request accept hogi
    io.emit("user disconnected:", socket.id); //frontend pr request bhejega
  })
  console.log("user connected:", socket.id);
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000, () => {
  console.log("chal gya bhai");
});
