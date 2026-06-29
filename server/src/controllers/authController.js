import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.");
  process.exit(1);
}

export const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hashedPassword } });
    return res.status(201).json({ success: true, message: "Registration successful" });
  } catch (error) {
    console.error("Registration Error:", error);
    // Prisma unique constraint violation
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "An account with this email already exists." });
    }
    return res.status(500).json({ success: false, message: "Registration failed. Please try again." });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ success: true, token, user: { email: user.email } });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
};