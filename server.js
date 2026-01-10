import express from "express"
import dotenv from "dotenv"
import cors from "cors"
dotenv.config()
const app= express()
app.use(cors())
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Society Fund Backend Running 🚀");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})
