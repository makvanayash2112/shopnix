import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import {
  requireAuth,
  requireBuyer,
  serializeUser,
  type AuthRequest,
} from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";

const router = Router();

function signToken(userId: string) {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

/** Buyer register — email unique across all users */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      address?: Record<string, string>;
    };

    if (!name || !email || !password || !phone) {
      return sendError(res, "Name, email, password and phone are required");
    }

    if (password.length < 6) {
      return sendError(res, "Password must be at least 6 characters");
    }

    const emailLower = email.toLowerCase().trim();
    const exists = await User.findOne({ email: emailLower });
    if (exists) {
      return sendError(
        res,
        "This email is already registered. Please sign in.",
        409
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: emailLower,
      password: hashed,
      role: "buyer",
      phone: phone.trim(),
      address: address ?? {},
    });

    const token = signToken(user._id.toString());

    return sendSuccess(
      res,
      { token, user: serializeUser(user) },
      201,
      "Buyer account created"
    );
  } catch (err) {
    console.error(err);
    return sendError(res, "Registration failed", 500);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return sendError(res, "Email and password are required");
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password"
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendError(res, "Invalid email or password", 401);
    }

    if (user.role !== "buyer") {
      return sendError(
        res,
        "This email is registered as a seller. Use seller login at /login",
        403
      );
    }

    const token = signToken(user._id.toString());
    return sendSuccess(res, { token, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return sendError(res, "Login failed", 500);
  }
});

router.get("/me", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  return sendSuccess(res, serializeUser(req.user!));
});

router.put("/profile", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  const user = req.user!;
  const { name, phone, address } = req.body as {
    name?: string;
    phone?: string;
    address?: Record<string, string>;
  };

  if (name) user.name = name.trim();
  if (phone) user.phone = phone.trim();
  if (address) user.address = { ...user.address, ...address };

  await user.save();
  return sendSuccess(res, serializeUser(user), 200, "Profile updated");
});

export default router;
