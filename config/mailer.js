import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const transporter = new Resend(process.env.RESEND_API_KEY);

export default transporter;