const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = require('http').createServer(app);
const io = require('socket.io');
const cors = require('cors');
const {addUser,removeUser,getUser,getUsersInRoom} =require('./users')
const router = require('./router');
const admin = require('firebase-admin');
const serviceAccount = require('./whatsapp-a7d4a-e7860f7c9b52.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(cors());
app.use(router);

const socketio = new io.Server(httpServer,{
    cors:{
        origin:['*'],

        handlePreflightRequest:(req,res)=>{
            res.writeHead(200,{
                "Access-Control-Allow-Origin":"*",
                "Access-Control-Allow-Methods":"GET,POST",
                "Access-Control-Allow-Headers":"my-custom-header",
                "Access-Control-Allow-Credentials":true,
            })
            res.end();
        }
    }
})

socketio.on('connect',(socket)=>{
    console.log("New Connection");

    socket.on('join',({name,room},callback)=>{
        const{error,user}=addUser({id:socket.id,name,room});
        if(error) return callback(error);
        socket.join(user.room);

        const roomRef = db.collection(user.room);
        const previousMessages = [];

        const getPreviousMessages = async() => {
            const querySnapshot = await roomRef.get();
            querySnapshot.forEach(documentSnapshot => {
                previousMessages.push(documentSnapshot.data());
            })
            socketio.to(user.room).emit('prev-messages', previousMessages);
        }

        getPreviousMessages();

        // socket.emit('message',{user:'admin',text:`${user.name}, welcome to the room ${user.room}`})
        // socket.broadcast.to(user.room).emit('message',{user:'admin',text:`${user.name}, has joined!`})

        socketio.to(user.room).emit('roomData',{room:user.room,users : getUsersInRoom(user.room)})

        callback();
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const alluser = getUsersInRoom(socket.id);

        console.log("user ",user)
        socketio.to(user.room).emit('message', { user: user.name, text: message });
        socketio.to(user.room).emit('roomData',{room:user.room,users:getUsersInRoom(user.room)})

        const roomRef = db.collection(user.room);

        roomRef.doc(""+Date.now()).set({
            user: user.name,
            text: message
        })
    
        callback();
      });
    

    socket.on('disconnect',()=>{
         const user=removeUser(socket.id);
        if(user){
            socketio.to(user.room).emit('message',{user:'admin',text:`${user.name} has left`})
        }
    })
})


httpServer.listen(PORT,()=>{
    console.log(`Server is running on ${PORT}`)
})