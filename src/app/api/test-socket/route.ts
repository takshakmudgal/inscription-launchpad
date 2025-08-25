import { type NextRequest, NextResponse } from "next/server";
import { emitToAll, getSocketIOServer } from "../../../lib/socket";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    // Get the Socket.IO server instance
    const io = getSocketIOServer();

    if (!io) {
      return NextResponse.json(
        {
          error:
            "Socket.IO server not initialized. Make a request to /api/socket first.",
        },
        { status: 503 },
      );
    }

    // Emit message to all connected clients
    emitToAll("test-message", {
      message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Message broadcasted to all clients",
      connectedClients: io.engine.clientsCount,
    });
  } catch (error) {
    console.error("Error in test-socket API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
