import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set.");
  process.exit(1);
}

const signAccessToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });

export const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required." });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword } });
    const accessToken = signAccessToken(user.id);

    return res.status(201).json({ success: true, accessToken, user: { email: user.email } });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ success: false, message: "Email already exists." });
    return res.status(500).json({ success: false, message: "Registration failed." });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const accessToken = signAccessToken(user.id);
    return res.json({ success: true, accessToken, user: { email: user.email } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed." });
  }
};