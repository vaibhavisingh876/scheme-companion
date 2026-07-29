import prisma from "../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { sendMail } from "../services/emailService.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = process.env.JWT_SECRET;
// Falls back to a derived secret if you haven't set JWT_REFRESH_SECRET yet,
// so this doesn't break your running app on deploy. Set a real, separate
// JWT_REFRESH_SECRET in production — see the implementation guide.
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.");
  process.exit(1);
}

const signAccessToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: "15m" });
const signRefreshToken = (userId) => jwt.sign({ userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: "30d" });
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Issues a fresh access+refresh pair and stores a hash of the refresh token
// so it can be revoked (logout, password reset) without needing a separate
// token-blocklist table.
const issueTokens = async (user) => {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken) },
  });
  return { accessToken, refreshToken };
};

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
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.user.create({
      data: { email, password: hashedPassword, verificationToken, verificationExpiry },
    });

    const verifyUrl = `${CLIENT_URL}/verify-email?token=${verificationToken}`;
    await sendMail({
      to: email,
      subject: "Verify your email",
      html: `<p>Welcome! Click <a href="${verifyUrl}">here</a> to verify your email. This link expires in 24 hours.</p>`,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    logger.error("Registration Error:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "An account with this email already exists." });
    }
    return res.status(500).json({ success: false, message: "Registration failed. Please try again." });
  }
};

export const verifyEmail = async (req, res) => {
  const { token } = req.query;
  try {
    if (!token) {
      return res.status(400).json({ success: false, message: "Verification token is required." });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token, verificationExpiry: { gt: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification link." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null, verificationExpiry: null },
    });

    return res.json({ success: true, message: "Email verified successfully. You can now log in." });
  } catch (error) {
    logger.error("Verify Email Error:", error);
    return res.status(500).json({ success: false, message: "Verification failed." });
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

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email before logging in." });
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    return res.json({ success: true, accessToken, refreshToken, user: { email: user.email } });
  } catch (error) {
    logger.error("Login Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error during login." });
  }
};

// POST /api/auth/refresh { refreshToken } → new { accessToken, refreshToken }
// Rotates the refresh token on every use (single active refresh token per
// user) so a leaked-but-unused old token stops working the next time the
// legitimate client refreshes.
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token." });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ success: false, message: "Refresh token no longer valid." });
    }

    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
    return res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error("Refresh Error:", error);
    return res.status(500).json({ success: false, message: "Failed to refresh token." });
  }
};

// POST /api/auth/logout — requires `protect` middleware (needs req.user.userId)
export const logout = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { refreshTokenHash: null },
    });
    return res.json({ success: true, message: "Logged out." });
  } catch (error) {
    logger.error("Logout Error:", error);
    return res.status(500).json({ success: false, message: "Logout failed." });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same response whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await prisma.user.update({ where: { id: user.id }, data: { resetToken, resetExpiry } });

      const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;
      await sendMail({
        to: email,
        subject: "Reset your password",
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
      });
    }

    return res.json({
      success: true,
      message: "If an account exists for this email, a reset link has been sent.",
    });
  } catch (error) {
    logger.error("Forgot Password Error:", error);
    return res.status(500).json({ success: false, message: "Failed to process request." });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetExpiry: { gt: new Date() } },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpiry: null,
        refreshTokenHash: null, // force re-login on all devices after a reset
      },
    });

    return res.json({ success: true, message: "Password reset successful. Please log in." });
  } catch (error) {
    logger.error("Reset Password Error:", error);
    return res.status(500).json({ success: false, message: "Failed to reset password." });
  }
};