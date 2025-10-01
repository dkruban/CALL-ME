const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store active users and their rooms
const users = {}; // { socketId: { number: '8080', id: socketId } }

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join-room', (number) => {
    const validNumbers = ['8080', '9999', '1212', '0000'];
    if (!validNumbers.includes(number)) {
      socket.emit('error', 'Invalid number');
      return;
    }

    // If user was in a previous room, remove them
    if (users[socket.id]) {
        socket.leave(users[socket.id].number);
    }

    // Join the new room
    socket.join(number);
    users[socket.id] = { number, id: socket.id };
    console.log(`User ${socket.id} joined room ${number}`);

    // Send the updated list of users to everyone in the room
    const usersInRoom = Object.values(users).filter(u => u.number === number);
    io.to(number).emit('update-users-list', usersInRoom);

    // Notify others that a new user has joined (optional, for status messages)
    socket.to(number).emit('user-joined', socket.id);
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', { offer: data.offer, sender: socket.id });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', { answer: data.answer, sender: socket.id });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log(`User ${socket.id} disconnected from room ${user.number}`);
      delete users[socket.id];

      // Send the updated list of users to everyone in the room
      const usersInRoom = Object.values(users).filter(u => u.number === user.number);
      io.to(user.number).emit('update-users-list', usersInRoom);
      
      // Notify others that a user has left
      socket.to(user.number).emit('user-left', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
