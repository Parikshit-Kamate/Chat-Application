const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const Message = require('./Chat/application');

const app = express();
app.use(cors());
app.use(express.json());


mongoose.connect('mongodb://127.0.0.1:27017/b0506')
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.log('Error connecting to MongoDB:', error));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});


io.on('connection', async (socket) => {
    console.log('User Connected:', socket.id);


    const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
    socket.emit('load_messages', messages);


    socket.on('send_message', async (data) => {

        const newMessage = new Message({
            username: data.username,
            message: data.message,
        });
        await newMessage.save();


        io.emit('receive_message', newMessage);
    });


    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
    });
});


const PORT = 8000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});    