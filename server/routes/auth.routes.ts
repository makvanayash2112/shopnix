import { Router } from "express";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { Seller } from "../models/Seller";
import { sendError, sendSuccess } from "../utils/response";
import { assignOndcProviderId } from "../services/ondc/seller-readiness.service";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, storeName } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      storeName?: string;
      phone?: string;
      gstin?: string;
      pan?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        pincode?: string;
      };
    };

    const phone = req.body.phone?.trim();
    const address = req.body.address ?? {};
    const hasTaxId = Boolean(req.body.gstin?.trim() || req.body.pan?.trim());

    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      !storeName?.trim() ||
      !phone ||
      !address.street?.trim() ||
      !address.city?.trim() ||
      !address.state?.trim() ||
      !address.pincode?.trim() ||
      !hasTaxId
    ) {
      return sendError(
        res,
        "Name, email, password, store name, phone, full store address and GSTIN or PAN are required"
      );
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedPhone = phone.replace(/\s+/g, "");
    const normalizedGstin = req.body.gstin?.trim().toUpperCase();
    const normalizedPan = req.body.pan?.trim().toUpperCase();

    const [existingUser, existingSellerEmail, existingSellerPhone, existingSellerGstin, existingSellerPan] =
      await Promise.all([
        User.findOne({ email: normalizedEmail }),
        Seller.findOne({ email: normalizedEmail }),
        normalizedPhone ? Seller.findOne({ phone: normalizedPhone }) : null,
        normalizedGstin ? Seller.findOne({ gstin: normalizedGstin }) : null,
        normalizedPan ? Seller.findOne({ pan: normalizedPan }) : null,
      ]);

    if (existingUser || existingSellerEmail) {
      return sendError(res, "Email already registered", 409);
    }
    if (existingSellerPhone) {
      return sendError(res, "Phone number already registered", 409);
    }
    if (existingSellerGstin) {
      return sendError(res, "GSTIN already registered", 409);
    }
    if (existingSellerPan) {
      return sendError(res, "PAN already registered", 409);
    }

    const sellerId = new Types.ObjectId();
    const ondcProviderId = assignOndcProviderId({
      _id: sellerId,
      storeName: storeName.trim(),
    });

    const seller = await Seller.create({
      _id: sellerId,
      storeName: storeName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      gstin: normalizedGstin,
      pan: normalizedPan,
      address: {
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
        country: "India",
      },
      ondc: {
        bppId: env.ondc.bppId,
        bppUri: env.ondc.bppUri,
        domain: env.ondc.domain,
        city: env.ondc.city,
        isActive: true,
        subscriberId: env.ondc.subscriberId || env.ondc.bppId,
      },
      ondcProviderId,
    });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashed,
      role: "seller",
      sellerId: seller._id,
      phone: normalizedPhone,
      address: seller.address,
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
