import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../lib/auth";

export interface AuthUser {
  id: string;
  role: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyJWT(token);
  if (!payload || typeof payload.sub !== "string") {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = {
    id: payload.sub,
    role: payload.role as string,
    username: payload.username as string,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}
