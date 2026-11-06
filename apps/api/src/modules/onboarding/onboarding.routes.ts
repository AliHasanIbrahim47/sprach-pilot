import {
  citySearchQuerySchema,
  onboardingStepBodySchema,
  quizSubmissionSchema,
} from "@sprachpilot/shared";
import type { RequestHandler, Router } from "express";
import { Router as createRouter } from "express";

import { validateBody, validateQuery } from "../../middleware/validate.js";
import { bindRoute, tagRouter } from "../access/route-access.js";
import type { OnboardingController } from "./onboarding.controller.js";

const learn = { kind: "permission", permission: "learn" } as const;

export function createOnboardingRouter(
  controller: OnboardingController,
  requireAuth: RequestHandler,
): Router {
  const router = tagRouter(createRouter(), "/v1");

  bindRoute(
    router,
    "get",
    "/onboarding",
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
    "/onboarding",
    learn,
    [
      validateBody(onboardingStepBodySchema),
      (req, res, next) => {
        void controller.save(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "get",
    "/onboarding/quiz",
    learn,
    [
      (req, res, next) => {
        void controller.quiz(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/onboarding/quiz",
    learn,
    [
      validateBody(quizSubmissionSchema),
      (req, res, next) => {
        void controller.scoreQuiz(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/onboarding/complete",
    learn,
    [
      (req, res, next) => {
        void controller.complete(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "post",
    "/onboarding/skip",
    learn,
    [
      (req, res, next) => {
        void controller.skip(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  bindRoute(
    router,
    "get",
    "/cities",
    learn,
    [
      validateQuery(citySearchQuerySchema),
      (req, res, next) => {
        void controller.searchCities(req, res).catch(next);
      },
    ],
    requireAuth,
  );

  return router;
}
