import SocketIO from "socket.io";
import { ROOMS_SOURCE } from "./app.config";

const DEFAULT_ROOM = "room-1";
// Constructor
class Office {
  constructor(officeController, roomsController, server) {
    this.officeController = officeController;
    this.roomsController = roomsController;
    this.server = server;
    this.lastActivity = new Date().getTime();
    // this.io = new SocketIO(server);
    this.io = new SocketIO(server, {
      pingInterval: 10000,
      pingTimeout: 60000,
      upgradeTimeout: 30000,
    });
  }

  start() {
    this.roomsController.reloadRoomsListener(ROOMS_SOURCE, () => this.updateRooms());
    this.roomsController.sortRoomsListener(
      roomId => this.officeController.getUsersByRoom(roomId),
      () => this.lastActivity,
      () => this.updateRooms());

    this.io.use((socket, next) => {
      const serializedUser = socket.handshake.query.user;

      try {
        socket.user = JSON.parse(serializedUser);

        console.log("socket.id:", socket.id);
        next();
      } catch (err) {
        console.error(`Error on parse user: '${serializedUser}'`, err);

        next(new Error("Invalid user"));
      }
    });

    this.io.on("connection", socket => {
      const currentUser = socket.user;
      currentUser.socketId = socket.id;

      console.log("connected:", currentUser.id, new Date());

      const room_param = socket.handshake.query.room;
      const room = room_param || DEFAULT_ROOM;

      this.addUserInRoom(socket.user, room);

      socket.emit("sync-office", this.officeController.getUsersInOfficeByMap());

      socket.on("disconnect", socket => {
        if (this.canDisconnectUser(currentUser.id)) {
          console.log("disconect:", currentUser.id, new Date().getTime());
          this.io.sockets.emit("disconnect", currentUser.id);
          this.officeController.removeUser(currentUser.id);
          setTimeout(() => {
            this.openEmptyRooms();
          }, 5000);
        }
      });

      socket.on("enter-room", data => {
        this.addUserInRoom(currentUser, data.room);
      });

      socket.on("close-room", data => {
        this.closeRoom(currentUser, data.room);
      });

      socket.on("open-room", data => {
        this.openRoom(currentUser, data.room);
      });

      socket.on("knock-room", data => {
        this.knockRoom(currentUser, data.room);
      });

      socket.on("start-meet", userId => {
        this.updateUserMeetInformation(userId, "start-meet", true);
      });

      socket.on("left-meet", userId => {
        this.updateUserMeetInformation(userId, "left-meet", false);
      });

      socket.on("get-user-to-room", data => {
        const userInRoom = this.officeController.getUserInRoom(data.user);
        if (userInRoom) {
          this.io
            .to(userInRoom.user.socketId)
            .emit("get-user-to-room", { user: currentUser, room: data.room });
        }
      });

      socket.on("allow-user-enter-room", data => {
        const userInRoom = this.officeController.getUserInRoom(data.user);
        if (userInRoom) {
          this.io
            .to(userInRoom.user.socketId)
            .emit("enter-room-allowed", { user: currentUser, room: data.room });
        }
      });

      socket.on("user-activity", () => {
        this.lastActivity = new Date().getTime();
      });

    });
  }

  updateUserMeetInformation(userId, meetEvent, isUserInMeet) {
    this.officeController.setUserInMeet(userId, isUserInMeet);

    const userInRoom = this.officeController.getUserInRoom(userId);
    this.io.sockets.emit(meetEvent, userInRoom);
  }

  addUserInRoom(user, room) {
    this.officeController.addUserInRoom(user, room);
    const userInRoom = this.officeController.getUserInRoom(user.id);
    this.io.sockets.emit("enter-room", userInRoom);

    this.openEmptyRooms();
  }

  openEmptyRooms() {
    const rooms = this.roomsController.getRooms();
    let shouldUpdateRooms = false;
    rooms.forEach(room => {
      if (room.closed) {
        const usersInRoom = this.officeController.getUsersByRoom(room.id);
        if (usersInRoom.length === 0) {
          console.log('opening room', room.id);
          room.closed = false;
          shouldUpdateRooms = true;
        }
      }
    });
    if (shouldUpdateRooms) {
      this.updateRooms();
    }
  }

  closeRoom(user, room) {
    this.roomsController.closeRoom(room);
    this.updateRooms();
  }

  openRoom(user, room) {
    this.roomsController.openRoom(room);
    this.updateRooms();
  }

  knockRoom(user, room) {
    const usersInRoom = this.officeController.getUsersByRoom(room);
    usersInRoom.forEach(userInRoom => {
      this.io
        .to(userInRoom.user.socketId)
        .emit("answer-knock-room", { user, room });
    });
  }

  updateRooms() {
    this.io.sockets.emit("update-rooms", this.roomsController.getRooms());
  }

  canDisconnectUser(userId) {
    const { sockets } = this.io.sockets;
    for (const socketId in sockets) {
      const loggedSocket = sockets[socketId];
      if (userId == loggedSocket.user.id) {
        return false;
      }
    }
    return true;
  }
}

module.exports = Office;
