const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active users and their rooms
const users = {};

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining a room based on their number
  socket.on('join-room', (number) => {
    // Validate the number
    const validNumbers = ['8080', '9999', '1212', '0000'];
    if (!validNumbers.includes(number)) {
      socket.emit('error', 'Invalid number');
      return;
    }

    // Join the room based on the number
    socket.join(number);
    users[socket.id] = number;
    console.log(`User ${socket.id} joined room ${number}`);

    // Notify other users in the room
    socket.to(number).emit('user-joined', socket.id);
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const number = users[socket.id];
    if (number) {
      socket.to(number).emit('user-left', socket.id);
      delete users[socket.id];
      console.log(`User ${socket.id} left room ${number}`);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
