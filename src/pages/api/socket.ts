import type { NextApiRequest, NextApiResponse } from "next";
import { Server as NetServer } from "http";
import { Server as ServerIO } from "socket.io";
import { setSocketIOServer } from "../../lib/socket";

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: ServerIO;
    };
  };
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO,
) {
  if (!res.socket.server.io) {
    console.log("🔄 Starting Socket.IO server with Next.js...");

    const io = new ServerIO(res.socket.server, {
      path: "/api/socket",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      console.log("✅ Client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
      });

      socket.on("message", (data) => {
        console.log("📨 Received message:", data);
        io.emit("message", data);
      });

      socket.on("broadcast", (data) => {
        socket.broadcast.emit("broadcast", data);
      });
    });

    res.socket.server.io = io;
    setSocketIOServer(io); // Register the instance globally
    console.log("✅ Socket.IO server started with Next.js");
  }

  res.json({ message: "Socket.IO server is running" });
}
