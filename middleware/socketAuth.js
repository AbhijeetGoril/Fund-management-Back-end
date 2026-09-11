import jwt from "jsonwebtoken";

// Manually parses the authToken value out of the raw cookie header
// string Socket.IO gives us — avoids relying on the `cookie` package's
// export shape, which varies across versions/module systems.
const extractAuthToken = (rawCookieHeader) => {
  if (!rawCookieHeader) return null;
  const match = rawCookieHeader.match(/(?:^|;\s*)authToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const socketAuth = (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers?.cookie;
    const token = extractAuthToken(rawCookie);

    if (!token) {
      return next(new Error("Authentication required — no authToken cookie found."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token: " + error.message));
  }
};