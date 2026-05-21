import { Router } from "express";
import { getNetworkGuide } from "../constants/ondc-network";
import { sendSuccess } from "../utils/response";

const router = Router();

router.get("/guide", (_req, res) => {
  return sendSuccess(res, getNetworkGuide());
});

export default router;
