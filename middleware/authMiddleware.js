import jwt from "jsonwebtoken";
export const authMiddleware=(req,res,next)=>{
  try {
    const token=req.cookies?.authToken || req.headers.authorization?.split("")[1]
    if(!token){
      return res.status(401).json({ message: "Not authorized" });
    }
    console.log(process.env.JWT_SECRET)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded; // contains user id
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
}