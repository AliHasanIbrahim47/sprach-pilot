import {
  AVATAR_CONTENT_TYPES,
  emailChangeBodySchema,
  emailChangeConfirmBodySchema,
  MAX_AVATAR_BYTES,
  notificationPreferencesSchema,
  passwordChangeBodySchema,
  quietHoursSchema,
  updateProfileBodySchema,
} from "@sprachpilot/shared";
import express, { type RequestHandler, Router } from "express";

import { validateBody } from "../../middleware/validate.js";
import { bindRoute, tagRouter } from "../access/route-access.js";
import { invalidAvatar } from "./image-type.js";
import type { SettingsController } from "./settings.controller.js";

const learn = { kind: "permission", permission: "learn" } as const;
const isPublic = { kind: "public" } as const;

export function createSettingsRouter(
  controller: SettingsController,
  requireAuth: RequestHandler,
): Router {
  const router = tagRouter(Router(), "/v1");

  bindRoute(
    router,
    "get",
    "/settings",
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
    "patch",
    "/settings/profile",
    learn,
    [
      validateBody(updateProfileBodySchema),
      (req, res, next) => {
        void controller.updateProfile(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "put",
    "/settings/notifications",
    learn,
    [
      validateBody(notificationPreferencesSchema),
      (req, res, next) => {
        void controller.updateNotifications(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "put",
    "/settings/quiet-hours",
    learn,
    [
      validateBody(quietHoursSchema),
      (req, res, next) => {
        void controller.updateQuietHours(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/settings/email",
    learn,
    [
      validateBody(emailChangeBodySchema),
      (req, res, next) => {
        void controller.requestEmailChange(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(router, "post", "/settings/email/confirm", isPublic, [
    validateBody(emailChangeConfirmBodySchema),
    (req, res, next) => {
      void controller.confirmEmailChange(req, res).catch(next);
    },
  ]);

  bindRoute(
    router,
    "post",
    "/settings/password",
    learn,
    [
      validateBody(passwordChangeBodySchema),
      (req, res, next) => {
        void controller.changePassword(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/settings/avatar",
    learn,
    [
      readAvatarBody(),
      (req, res, next) => {
        void controller.acceptAvatar(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  return router;
}

/**
 * Reads an image body. Oversized and non-image uploads become the same validation error.
 */
function readAvatarBody(): RequestHandler {
  const parser = express.raw({
    limit: MAX_AVATAR_BYTES + 64 * 1024,
    type: [...AVATAR_CONTENT_TYPES],
  });

  return (req, res, next) => {
    const type = req.header("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!type || !(AVATAR_CONTENT_TYPES as readonly string[]).includes(type)) {
      next(invalidAvatar());
      return;
    }
    parser(req, res, (error) => {
      if (error) {
        next(invalidAvatar());
        return;
      }
      next();
    });
  };
}
