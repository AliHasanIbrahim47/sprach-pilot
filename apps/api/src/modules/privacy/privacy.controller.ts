import type { UpdateConsentBody } from "@sprachpilot/shared";
import { ValidationError } from "@sprachpilot/shared";
import type { Request, Response } from "express";

import { type AuthCookieOptions, clearSessionCookies } from "../auth/auth-cookies.js";
import { getRequestAuth } from "../auth/require-auth.js";
import type { PrivacyService } from "./privacy.service.js";

export interface PrivacyController {
  show(req: Request, res: Response): Promise<void>;
  requestExport(req: Request, res: Response): Promise<void>;
  requestDeletion(req: Request, res: Response): Promise<void>;
  updateConsent(req: Request, res: Response): Promise<void>;
  download(req: Request, res: Response): Promise<void>;
}

export function createPrivacyController(
  privacy: PrivacyService,
  clientIp: (req: Request) => string,
  cookieOptions: AuthCookieOptions,
): PrivacyController {
  return {
    async show(req, res) {
      const body = await privacy.overview(getRequestAuth(req).sub);
      res.status(200).json(body);
    },

    async requestExport(req, res) {
      const body = await privacy.requestExport(getRequestAuth(req).sub);
      res.status(202).json(body);
    },

    async requestDeletion(req, res) {
      const body = await privacy.requestDeletion(getRequestAuth(req).sub);
      clearSessionCookies(res, cookieOptions);
      res.status(202).json(body);
    },

    async updateConsent(req, res) {
      const body = req.body as UpdateConsentBody;
      await privacy.updateConsent({
        userId: getRequestAuth(req).sub,
        policy: body.policy,
        granted: body.granted,
        ip: clientIp(req),
      });
      const overview = await privacy.overview(getRequestAuth(req).sub);
      res.status(200).json(overview);
    },

    async download(req, res) {
      const rawId = req.params["exportId"];
      const exportId = typeof rawId === "string" ? rawId : undefined;
      const token = typeof req.query["token"] === "string" ? req.query["token"] : "";
      if (!exportId || !token) throw new ValidationError({ detail: "Download link is invalid." });
      const zip = await privacy.readExport(exportId, token);
      res
        .status(200)
        .type("application/zip")
        .setHeader("content-disposition", 'attachment; filename="sprachpilot-export.zip"')
        .send(zip);
    },
  };
}
