
import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
    auth?: {
        userId: string;
        email: string;
        name: string;
    };
}

let JWKS: any = null;

async function getJWKS() {
    if (JWKS) {
        return JWKS;
    }

    const { createRemoteJWKSet } = await import("jose");

    const jwksUrl = process.env.AUTH_JWKS_URL;

    if (!jwksUrl) {
        throw new Error("AUTH_JWKS_URL is missing.");
    }

    JWKS = createRemoteJWKSet(new URL(jwksUrl));

    return JWKS;
}

export async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const { jwtVerify } = await import("jose");

        const issuer = process.env.AUTH_ISSUER;
        const audience = process.env.AUTH_AUDIENCE;

        if (!issuer || !audience) {
            throw new Error("JWT issuer or audience is missing.");
        }

        const authorization = req.headers.authorization;

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const token = authorization.substring(7);

        const { payload } = await jwtVerify(token, await getJWKS(), {
            issuer,
            audience,
        });

        if (
            typeof payload.sub !== "string" ||
            typeof payload.email !== "string"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        req.auth = {
            userId: payload.sub,
            email: payload.email,
            name:
                typeof payload.name === "string"
                    ? payload.name
                    : payload.email.split("@")[0],
        };

        next();
    } catch (error) {
        console.error("JWT verification failed:", error);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token.",
        });
    }
}
