# 🗺️ Real-Time Location Tracker

This project is a **real-time location tracker** built using **Node.js**, **Express.js**, **Socket.IO**, and **Leaflet.js**. It allows users to share their location with others in real time, visualized on an interactive map.

---

## ✨ Features

- 🌍 **Real-time location sharing:** Tracks and broadcasts user locations dynamically.
- 🗺️ **Interactive Map:** Displays locations with the Leaflet.js library using OpenStreetMap tiles.
- ⚡ **Real-Time Updates:** Powered by Socket.IO for smooth and instant communication.
- 📱 **Responsive Design:** Fully optimized for devices of all sizes.

---

## 🚀 Installation and Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/real-time-location-tracker.git
   cd real-time-location-tracker
Install dependencies:

bash
Copy code
npm install
Start the server:

bash
Copy code
node app.js
Open the application:

On your computer: Navigate to http://localhost:3000.
On another device (same network): Replace <your-ip> with your local IP address and navigate to:
arduino
Copy code
http://<your-ip>:3000
⚙️ How It Works
Backend (app.js):

Express.js serves the client-side files and handles HTTP requests.
Socket.IO manages real-time communication:
Listens for location updates (send-location) from clients.
Broadcasts location data (location-recieved) to all connected users.
Notifies users when someone disconnects.
Frontend:

Leaflet.js creates an interactive map and adds markers for user locations.
Geolocation API tracks the user's latitude and longitude and sends it to the backend.
As users share their location, the map updates in real time, displaying markers for all connected users.
Markers can be clicked to recenter the map on that user's location.
🖼️ Screenshot
Here’s a preview of the application in action:


Replace the path with the actual file location of your screenshot.

💻 Technologies Used
Node.js: JavaScript runtime for server-side development.
Express.js: Web framework for routing and middleware.
Socket.IO: Real-time bidirectional communication library.
Leaflet.js: Lightweight library for interactive maps.
EJS: Template engine for rendering dynamic HTML.
🚧 Future Enhancements
🔒 Add user authentication for secure location sharing.
🛠️ Display user names instead of random IDs.
🕒 Store historical location data for analysis.
🚦 Allow users to toggle location sharing on or off.
🤝 Contributing
We welcome contributions to this project! Here’s how you can get involved:

Fork the repository:
Click the "Fork" button at the top of the repository page to create a personal copy of the repository.

Clone your fork:
Clone the repository to your local machine:

bash
Copy code
git clone https://github.com/your-username/real-time-location-tracker.git
cd real-time-location-tracker
Create a new branch:
It's best practice to create a new branch for each feature or bug fix you work on.

bash
Copy code
git checkout -b your-feature-branch
Make your changes:
Implement your changes or add new features.

Commit your changes:
Commit your changes with a clear, concise commit message:

bash
Copy code
git commit -am 'Add new feature'
Push to your fork:
Push your changes to your forked repository:

bash
Copy code
git push origin your-feature-branch
Create a pull request:
Open a pull request (PR) on GitHub from your fork to the original repository. Provide a description of what you’ve done in the PR.

📬 Contact
If you have any questions or suggestions, feel free to reach out:

Email: your.email@example.com
Phone: +1 (555) 123-4567
📜 License
This project is open-source and available under the MIT License. See the LICENSE file for details.
