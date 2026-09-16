import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount;

if (process.env.FIREBASE_ADMIN_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_JSON);
} else {
  serviceAccount = JSON.parse(
    fs.readFileSync(path.join(__dirname, "firebase-admin.json"), "utf8")
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;