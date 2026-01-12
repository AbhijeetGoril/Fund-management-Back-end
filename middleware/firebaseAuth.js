import admin from "../config/firebase.js";

const firebaseAuth = async (req, res, next) => {
  try {
    // 1. Get Authorization header
    const authHeader = req.headers.authorization;

    // 2. Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 3. Extract token
    const token = authHeader.split(" ")[1];

    // 4. Verify token with Firebase
    const decodedUser = await admin.auth().verifyIdToken(token);

    // 5. Attach user data to request
    req.user = decodedUser;

    // 6. Move to next API
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Firebase token" });
  }
};

export default firebaseAuth;
