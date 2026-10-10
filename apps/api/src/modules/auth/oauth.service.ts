import { randomBytes, randomUUID } from "node:crypto";

import {
  AUTH_COPY,
  ForbiddenError,
  isUiLocale,
  type OAuthAuthenticatedResponse,
  type OAuthCallbackResponse,
  type OAuthGoogleCallbackBody,
  type OAuthGoogleLinkBody,
  type UiLocale,
  UnauthorizedError,
  ValidationError,
} from "@sprachpilot/shared";
import {
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";

import type { AccountRepository } from "./account.repository.js";
import { GOOGLE_PROVIDER } from "./account.repository.js";
import type { UserRepository } from "./auth.repository.js";
import type { AuthLogger, AuthRequestContext, IssuedCredentials } from "./auth.service.js";
import { CONSENT_POLICIES } from "./auth.service.js";
import type { GoogleIdentity, GoogleOAuthProvider } from "./google-oauth.provider.js";
import { hashIp } from "./ip-hash.js";
import type { AuthMetrics } from "./metrics.js";
import type { OAuthStateStore } from "./oauth-state.store.js";
import type { PasswordHasher } from "./password-hasher.js";
import type { SessionRepository } from "./session.repository.js";
import type { TokenService } from "./token.service.js";

const AUTHORIZE_TTL_SECONDS = 10 * 60;
const LINK_TTL_SECONDS = 10 * 60;

export interface OAuthServiceDependencies {
  enabled: boolean;
  redirectUri: string | null;
  google: GoogleOAuthProvider | null;
  users: UserRepository;
  accounts: AccountRepository;
  sessions: SessionRepository;
  tokens: TokenService;
  oauthState: OAuthStateStore;
  hasher: PasswordHasher;
  metrics: AuthMetrics;
  clock: () => Date;
  ipHashSecret: string;
  logger: AuthLogger;
}

export interface OAuthStartResult {
  authorizationUrl: string;
}

export interface OAuthAuthenticatedResult extends OAuthAuthenticatedResponse {
  credentials: IssuedCredentials;
  returnTo: string | null;
  locale: string;
}

export type OAuthCallbackResult =
  | OAuthAuthenticatedResult
  | (Extract<OAuthCallbackResponse, { status: "link_required" }> & {
      returnTo: string | null;
      locale: string;
    });

export interface OAuthService {
  isEnabled(): boolean;
  start(input: { returnTo?: string | null; locale?: string }): Promise<OAuthStartResult>;
  callback(
    input: OAuthGoogleCallbackBody,
    context: AuthRequestContext,
  ): Promise<OAuthCallbackResult>;
  confirmLink(
    input: OAuthGoogleLinkBody,
    context: AuthRequestContext,
  ): Promise<OAuthAuthenticatedResult>;
  unlink(userId: string): Promise<void>;
}

export function createOAuthService(dependencies: OAuthServiceDependencies): OAuthService {
  const {
    users,
    accounts,
    sessions,
    tokens,
    oauthState,
    hasher,
    metrics,
    clock,
    ipHashSecret,
    logger,
  } = dependencies;

  function requireGoogle(): { google: GoogleOAuthProvider; redirectUri: string } {
    const { google, redirectUri } = dependencies;
    if (!dependencies.enabled || !google || !redirectUri) {
      throw new ForbiddenError(AUTH_COPY.oauthDisabled);
    }
    return { google, redirectUri };
  }

  async function issueCredentials(
    user: { id: string; role: string },
    context: AuthRequestContext,
  ): Promise<IssuedCredentials> {
    const now = clock();
    const refreshToken = tokens.createRefreshToken();
    const familyId = randomUUID();
    await sessions.create({
      userId: user.id,
      familyId,
      refreshTokenHash: tokens.hashRefreshToken(refreshToken),
      expiresAt: new Date(now.getTime() + tokens.refreshTtlSeconds * 1000),
      userAgent: deviceUserAgent(context.userAgent),
      ipHash: hashIp(context.ip, ipHashSecret),
      now,
    });
    const accessToken = await tokens.signAccessToken(
      { sub: user.id, role: user.role, sid: familyId },
      now,
    );
    return {
      accessToken,
      refreshToken,
      accessMaxAgeSeconds: tokens.accessTtlSeconds,
      refreshMaxAgeSeconds: tokens.refreshTtlSeconds,
    };
  }

  async function authenticatedResult(
    user: {
      id: string;
      role: string;
      displayName: string;
      emailVerifiedAt: Date | null;
      onboardingCompletedAt: Date | null;
    },
    context: AuthRequestContext,
    meta: { returnTo: string | null; locale: string },
  ): Promise<OAuthAuthenticatedResult> {
    const credentials = await issueCredentials(user, context);
    metrics.recordLogin("success");
    return {
      status: "authenticated",
      needsOnboarding: user.onboardingCompletedAt === null,
      locale: meta.locale,
      user: {
        id: user.id,
        displayName: user.displayName,
        emailVerified: user.emailVerifiedAt !== null,
      },
      credentials,
      returnTo: meta.returnTo,
    };
  }

  return {
    isEnabled() {
      return Boolean(dependencies.enabled && dependencies.google && dependencies.redirectUri);
    },

    async start(input) {
      const { google, redirectUri } = requireGoogle();

      const state = randomState();
      const nonce = randomNonce();
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const locale = resolveLocale(input.locale);

      await oauthState.saveAuthorize(
        state,
        {
          codeVerifier,
          nonce,
          returnTo: sanitizeReturnTo(input.returnTo),
          locale,
        },
        AUTHORIZE_TTL_SECONDS,
      );

      const authorizationUrl = await google.buildAuthorizationUrl({
        state,
        nonce,
        codeChallenge,
        redirectUri,
      });
      return { authorizationUrl: authorizationUrl.href };
    },

    async callback(input, context) {
      const { google, redirectUri } = requireGoogle();

      const pending = await oauthState.takeAuthorize(input.state);
      if (!pending) {
        metrics.recordLogin("failure");
        throw new UnauthorizedError(AUTH_COPY.oauthStateInvalid);
      }

      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", input.code);
      callbackUrl.searchParams.set("state", input.state);

      let identity: GoogleIdentity;
      try {
        identity = await google.exchangeCallback({
          callbackUrl,
          codeVerifier: pending.codeVerifier,
          expectedState: input.state,
          expectedNonce: pending.nonce,
        });
      } catch (error) {
        metrics.recordLogin("failure");
        throw error;
      }

      const linked = await accounts.findByProvider(GOOGLE_PROVIDER, identity.providerAccountId);
      if (linked) {
        const user = await users.findById(linked.userId);
        if (!user || user.deletedAt !== null) {
          metrics.recordLogin("failure");
          throw new UnauthorizedError(AUTH_COPY.oauthFailed);
        }
        return authenticatedResult(user, context, {
          returnTo: pending.returnTo,
          locale: pending.locale,
        });
      }

      const existing = await users.findByEmail(identity.email);
      if (existing && existing.deletedAt === null) {
        if (!existing.passwordHash) {
          // Existing OAuth-only account without this Google subject — refuse to auto-claim.
          metrics.recordLogin("failure");
          throw new UnauthorizedError(AUTH_COPY.oauthFailed);
        }
        const linkToken = randomBytes(32).toString("base64url");
        await oauthState.saveLink(
          linkToken,
          {
            providerAccountId: identity.providerAccountId,
            email: identity.email,
            displayName: identity.displayName,
            userId: existing.id,
          },
          LINK_TTL_SECONDS,
        );
        return {
          status: "link_required",
          linkToken,
          email: existing.email,
          locale: pending.locale,
          returnTo: pending.returnTo,
        };
      }

      const locale = resolveLocale(pending.locale);
      const acceptedAt = clock();
      const created = await users.createWithConsent({
        email: identity.email,
        passwordHash: null,
        displayName: identity.displayName,
        uiLocale: locale,
        emailVerifiedAt: acceptedAt,
        consents: CONSENT_POLICIES.map((policy) => ({
          policy: policy.policy,
          version: policy.version,
          acceptedAt,
          ipHash: hashIp(context.ip, ipHashSecret),
        })),
      });

      if (created.status === "duplicate") {
        metrics.recordLogin("failure");
        throw new UnauthorizedError(AUTH_COPY.oauthFailed);
      }

      await accounts.link({
        userId: created.id,
        provider: GOOGLE_PROVIDER,
        providerAccountId: identity.providerAccountId,
      });
      metrics.recordRegister("created");
      logger.info("oauth registration created");

      const user = await users.findById(created.id);
      if (!user) {
        metrics.recordLogin("failure");
        throw new UnauthorizedError(AUTH_COPY.oauthFailed);
      }
      return authenticatedResult(user, context, {
        returnTo: pending.returnTo,
        locale: pending.locale,
      });
    },

    async confirmLink(input, context) {
      requireGoogle();
      const pending = await oauthState.peekLink(input.linkToken);
      if (!pending) {
        throw new ValidationError({
          detail: AUTH_COPY.oauthStateInvalid,
          errors: [
            {
              field: "linkToken",
              code: "token_invalid",
              message: AUTH_COPY.oauthStateInvalid,
            },
          ],
        });
      }

      const user = await users.findById(pending.userId);
      if (!user || user.deletedAt !== null || !user.passwordHash) {
        await oauthState.takeLink(input.linkToken);
        throw new UnauthorizedError(AUTH_COPY.invalidCredentials);
      }

      const passwordOk = await hasher.verify(user.passwordHash, input.password);
      if (!passwordOk) {
        throw new UnauthorizedError(AUTH_COPY.invalidCredentials);
      }

      await oauthState.takeLink(input.linkToken);

      const already = await accounts.findByProvider(GOOGLE_PROVIDER, pending.providerAccountId);
      if (already && already.userId !== user.id) {
        throw new UnauthorizedError(AUTH_COPY.oauthFailed);
      }
      if (!already) {
        await accounts.link({
          userId: user.id,
          provider: GOOGLE_PROVIDER,
          providerAccountId: pending.providerAccountId,
        });
      }

      return authenticatedResult(user, context, { returnTo: null, locale: user.uiLocale });
    },

    async unlink(userId) {
      requireGoogle();
      const user = await users.findById(userId);
      if (!user || user.deletedAt !== null) throw new UnauthorizedError();
      if (!user.passwordHash) {
        throw new ValidationError({
          detail: AUTH_COPY.oauthUnlinkNeedsPassword,
          errors: [
            {
              field: "password",
              code: "password_required",
              message: AUTH_COPY.oauthUnlinkNeedsPassword,
            },
          ],
        });
      }
      const removed = await accounts.unlink(userId, GOOGLE_PROVIDER);
      if (!removed) {
        throw new ValidationError({
          detail: AUTH_COPY.oauthNotLinked,
          errors: [
            {
              field: "provider",
              code: "not_linked",
              message: AUTH_COPY.oauthNotLinked,
            },
          ],
        });
      }
    },
  };
}

function resolveLocale(requested: string | undefined): UiLocale {
  if (requested && isUiLocale(requested)) return requested;
  return "en";
}

function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes("\\") || value.includes("://")) return null;
  return value;
}

function deviceUserAgent(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replaceAll("\u0000", "");
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 256);
}
