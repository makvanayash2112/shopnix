import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { Seller } from "../models/Seller";
import { sendError, sendSuccess } from "../utils/response";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, storeName } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      storeName?: string;
    };

    if (!name || !email || !password) {
      return sendError(res, "Name, email and password are required");
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return sendError(res, "Email already registered", 409);
    }

    const seller = await Seller.create({
      storeName: storeName || env.defaultStoreName,
      email: email.toLowerCase(),
      ondc: {
        bppId: env.ondc.bppId,
        bppUri: env.ondc.bppUri,
        domain: env.ondc.domain,
        city: env.ondc.city,
        isActive: true,
      },
    });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "seller",
      sellerId: seller._id,
    });

    const token = jwt.sign({ userId: user._id }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    });

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          sellerId: seller._id,
        },
      },
      201,
      "Registration successful"
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

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendError(res, "Invalid credentials", 401);
    }

    if (user.role === "buyer") {
      return sendError(
        res,
        "This is a buyer account. Please sign in at /shop/login",
        403
      );
    }

    const token = jwt.sign({ userId: user._id }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    });

    return sendSuccess(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        sellerId: user.sellerId,
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, "Login failed", 500);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  return sendSuccess(res, {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    sellerId: user.sellerId,
  });
});

export default router;
