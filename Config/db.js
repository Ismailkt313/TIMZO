const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ DB CONNECTED");
  } catch (error) {
    console.log("❌ DB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
