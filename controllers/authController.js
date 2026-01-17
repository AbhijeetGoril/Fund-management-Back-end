import bcrypt from "bcryptjs"

export const sendOtp  = async (req,res)=>{
  try {
    const {email}=req.body
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
  } catch (error) {
    
  }
}