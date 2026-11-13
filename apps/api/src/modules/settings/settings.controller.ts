import type {
  EmailChangeBody,
  EmailChangeConfirmBody,
  NotificationPreferences,
  PasswordChangeBody,
  QuietHours,
  UpdateProfileBody,
} from "@sprachpilot/shared";
import type { Request, Response } from "express";

import { getRequestAuth } from "../auth/require-auth.js";
import type { SettingsMetrics } from "./settings.metrics.js";
import type { SettingsService } from "./settings.service.js";

export interface SettingsController {
  show(req: Request, res: Response): Promise<void>;
  updateProfile(req: Request, res: Response): Promise<void>;
  updateNotifications(req: Request, res: Response): Promise<void>;
  updateQuietHours(req: Request, res: Response): Promise<void>;
  requestEmailChange(req: Request, res: Response): Promise<void>;
  confirmEmailChange(req: Request, res: Response): Promise<void>;
  changePassword(req: Request, res: Response): Promise<void>;
  acceptAvatar(req: Request, res: Response): Promise<void>;
}

export function createSettingsController(
  settings: SettingsService,
  metrics: SettingsMetrics,
): SettingsController {
  async function timed(res: Response, status: number, work: () => Promise<unknown>): Promise<void> {
    const started = performance.now();
    try {
      sendJson(res, status, await work());
    } finally {
      metrics.recordSave(performance.now() - started);
    }
  }

  return {
    async show(req, res) {
      sendJson(res, 200, await settings.get(getRequestAuth(req).sub));
    },

    async updateProfile(req, res) {
      const body = req.body as UpdateProfileBody;
      await timed(res, 200, () => settings.updateProfile(getRequestAuth(req).sub, body));
    },

    async updateNotifications(req, res) {
      const body = req.body as NotificationPreferences;
      await timed(res, 200, () => settings.updateNotifications(getRequestAuth(req).sub, body));
    },

    async updateQuietHours(req, res) {
      const body = req.body as QuietHours;
      await timed(res, 200, () => settings.updateQuietHours(getRequestAuth(req).sub, body));
    },

    async requestEmailChange(req, res) {
      const body = req.body as EmailChangeBody;
      const locale = req.header("accept-language")?.split(",")[0]?.split("-")[0];
      await timed(res, 202, () =>
        settings.requestEmailChange(getRequestAuth(req).sub, body, locale),
      );
    },

    async confirmEmailChange(req, res) {
      const body = req.body as EmailChangeConfirmBody;
      await timed(res, 200, () => settings.confirmEmailChange(body.token));
    },

    async changePassword(req, res) {
      const body = req.body as PasswordChangeBody;
      const auth = getRequestAuth(req);
      await timed(res, 200, () => settings.changePassword(auth.sub, auth.sid, body));
    },

    async acceptAvatar(req, res) {
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      await timed(res, 202, () => settings.acceptAvatar(getRequestAuth(req).sub, bytes));
    },
  };
}

function sendJson(res: Response, status: number, body: unknown): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}
