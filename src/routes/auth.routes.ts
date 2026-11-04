
import { Router } from "express";
import {
    authenticate,
    AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

router.get(
    "/me",
    authenticate,
    (req: AuthenticatedRequest, res) => {
        res.status(200).json({
            success: true,
            message: "Authentication successful.",
            user: req.auth,
        });
    }
);

export default router;
