import { Server as ServerIO } from "socket.io";

// Global reference to the Socket.IO server instance
declare global {
  var socketIO: ServerIO | undefined;
}

export function initSocketIO(httpServer: any): ServerIO {
  if (!globalThis.socketIO) {
    console.log("🔄 Initializing Socket.IO with Next.js server...");

    globalThis.socketIO = new ServerIO(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });

    // Event handlers
    globalThis.socketIO.on("connection", (socket) => {
      console.log("✅ Client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
      });

      // Example message handler
      socket.on("message", (data) => {
        console.log("📨 Received message:", data);
        globalThis.socketIO?.emit("message", data);
      });

      // Broadcast to all clients
      socket.on("broadcast", (data) => {
        socket.broadcast.emit("broadcast", data);
      });
    });

    console.log("✅ Socket.IO server initialized with Next.js");
  }

  return globalThis.socketIO;
}

export function setSocketIOServer(io: ServerIO): void {
  globalThis.socketIO = io;
}

export function getSocketIOServer(): ServerIO | undefined {
  return globalThis.socketIO;
}

// Helper function to emit to all connected clients
export function emitToAll(event: string, data: any): void {
  const io = getSocketIOServer();
  if (io) {
    io.emit(event, data);
  }
}

// Helper function to emit to a specific room
export function emitToRoom(room: string, event: string, data: any): void {
  const io = getSocketIOServer();
  if (io) {
    io.to(room).emit(event, data);
  }
}
