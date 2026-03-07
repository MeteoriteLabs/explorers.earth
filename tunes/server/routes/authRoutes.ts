import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { db } from "../db";
import { emailService } from "../services/email-service";
import type { IStorage } from "../storage";

async function verifyEmailToken(token: string, storage: IStorage) {
  let result = await emailService.verifyUserEmail(token);

  if (!result.success) {
    console.log("Email service verification failed, attempting direct verification");
    const user = await storage.getUserByVerificationToken(token);

    if (!user) {
      return {
        status: 400,
        body: {
          success: false,
          message: "Invalid or expired verification token",
        },
      };
    }

    if (user.emailVerificationExpiry && new Date() > new Date(user.emailVerificationExpiry)) {
      return {
        status: 400,
        body: {
          success: false,
          message: "Verification token has expired",
        },
      };
    }

    const updated = await storage.markEmailAsVerified(user.id);
    if (!updated) {
      return {
        status: 500,
        body: {
          success: false,
          message: "Failed to mark email as verified",
        },
      };
    }

    result = {
      success: true,
      message: "Email verified successfully",
      userId: user.id,
    };
  }

  if (result.success) {
    return {
      status: 200,
      body: {
        success: true,
        message: result.message,
      },
    };
  }

  return {
    status: 400,
    body: {
      success: false,
      message: result.error,
    },
  };
}

function createVerifyEmailHandler(getToken: (req: Request) => string | undefined, logLabel: string, storage: IStorage) {
  return async (req: Request, res: Response) => {
    try {
      const token = getToken(req);

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification token",
        });
      }

      console.log(`Verifying email with token (${logLabel}):`, token);
      const result = await verifyEmailToken(token, storage);
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error verifying email:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while verifying your email",
      });
    }
  };
}

function createResendVerificationHandler() {
  return async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user!;

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "No email address is associated with this account",
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      console.log("Resending verification email to user:", user.id);
      const result = await emailService.sendEmailVerification(user.id, user.email, user.username);

      if (result.success) {
        return res.json({
          success: true,
          message: `Verification email has been sent to ${user.email}`,
        });
      }

      return res.status(500).json({
        success: false,
        message: result.error || "Failed to send verification email",
      });
    } catch (error) {
      console.error("Error resending verification email:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while resending verification email",
      });
    }
  };
}

export function setupAuthRoutes(app: Express, storage: IStorage) {
  app.post("/api/login", passport.authenticate("local"), async (req: Request, res: Response) => {
    try {
      await db.execute(
        `INSERT INTO user_sessions
        (user_id, start_time, device_info, ip_address)
        VALUES ($1, NOW(), $2, $3)`,
        [req.user!.id, JSON.stringify({ userAgent: req.headers["user-agent"] }), req.ip]
      );
    } catch (error) {
      console.error("Error logging user session:", error);
    }

    return res.status(200).json(req.user);
  });

  app.post("/api/logout", async (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      try {
        await db.execute(
          `UPDATE user_sessions
          SET end_time = NOW()
          WHERE user_id = $1
          AND end_time IS NULL`,
          [req.user.id]
        );
      } catch (error) {
        console.error("Error updating session end time:", error);
      }
    }

    req.logout((err) => {
      if (err) {
        return next(err);
      }
      return res.sendStatus(200);
    });
  });

  // Requested API shape
  app.post("/api/verify-email", createVerifyEmailHandler((req) => req.body?.token, "POST", storage));
  app.post("/api/verify-email/resend", createResendVerificationHandler());

  // Backward-compatible aliases currently used by client
  app.get("/api/verify-email", createVerifyEmailHandler((req) => {
    const token = req.query.token;
    return typeof token === "string" ? token : undefined;
  }, "GET", storage));
  app.post("/api/verify-email/:token", createVerifyEmailHandler((req) => req.params.token, "POST", storage));
  app.post("/api/resend-verification", createResendVerificationHandler());
}
