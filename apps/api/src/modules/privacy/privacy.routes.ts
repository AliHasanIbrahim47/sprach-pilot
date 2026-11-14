import { updateConsentBodySchema } from "@sprachpilot/shared";
import type { RequestHandler, Router } from "express";
import { Router as createRouter } from "express";

import { validateBody } from "../../middleware/validate.js";
import { bindRoute, tagRouter } from "../access/route-access.js";
import type { PrivacyController } from "./privacy.controller.js";

const learn = { kind: "permission", permission: "learn" } as const;
const isPublic = { kind: "public" } as const;

export function createPrivacyRouter(
  controller: PrivacyController,
  requireAuth: RequestHandler,
): Router {
  const router = tagRouter(createRouter(), "/v1");

  bindRoute(
    router,
    "get",
    "/privacy",
    learn,
    [
      (req, res, next) => {
        void controller.show(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/privacy/export",
    learn,
    [
      (req, res, next) => {
        void controller.requestExport(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/privacy/deletion",
    learn,
    [
      (req, res, next) => {
        void controller.requestDeletion(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "put",
    "/privacy/consents",
    learn,
    [
      validateBody(updateConsentBodySchema),
      (req, res, next) => {
        void controller.updateConsent(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(router, "get", "/privacy/exports/:exportId/download", isPublic, [
    (req, res, next) => {
      void controller.download(req, res).catch(next);
    },
  ]);

  return router;
}
