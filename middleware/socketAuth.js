import jwt from "jsonwebtoken";

// Same JWT your authMiddleware verifies for REST — reused here so a
// socket connection is authenticated the same way an HTTP request is.
export const socketAuth = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token."));
  }
};