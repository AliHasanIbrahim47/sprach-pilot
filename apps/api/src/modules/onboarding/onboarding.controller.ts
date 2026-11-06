import type { OnboardingStepBody, QuizSubmission } from "@sprachpilot/shared";
import type { Request, Response } from "express";

import { getRequestAuth } from "../auth/require-auth.js";
import type { OnboardingService } from "./onboarding.service.js";

export interface OnboardingController {
  show(req: Request, res: Response): Promise<void>;
  save(req: Request, res: Response): Promise<void>;
  quiz(req: Request, res: Response): Promise<void>;
  scoreQuiz(req: Request, res: Response): Promise<void>;
  complete(req: Request, res: Response): Promise<void>;
  skip(req: Request, res: Response): Promise<void>;
  searchCities(req: Request, res: Response): Promise<void>;
}

export function createOnboardingController(onboarding: OnboardingService): OnboardingController {
  return {
    async show(req, res) {
      const body = await onboarding.get(getRequestAuth(req).sub);
      sendJson(res, body);
    },

    async save(req, res) {
      const body = await onboarding.save(getRequestAuth(req).sub, req.body as OnboardingStepBody);
      sendJson(res, body);
    },

    async quiz(_req, res) {
      sendJson(res, onboarding.quiz());
    },

    async scoreQuiz(req, res) {
      sendJson(res, onboarding.scoreQuiz(req.body as QuizSubmission));
    },

    async complete(req, res) {
      sendJson(res, await onboarding.complete(getRequestAuth(req).sub));
    },

    async skip(req, res) {
      sendJson(res, await onboarding.skip(getRequestAuth(req).sub));
    },

    async searchCities(req, res) {
      const query = req.query as { q: string };
      sendJson(res, onboarding.searchCities(query.q));
    },
  };
}

function sendJson(res: Response, body: unknown): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(body);
}
