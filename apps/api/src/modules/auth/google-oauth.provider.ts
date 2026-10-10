import { AUTH_COPY, ExternalServiceError, UnauthorizedError } from "@sprachpilot/shared";
import * as client from "openid-client";

const GOOGLE_ISSUER = new URL("https://accounts.google.com");
const SCOPES = "openid email profile";

export interface GoogleIdentity {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}

export interface GoogleOAuthProvider {
  buildAuthorizationUrl(input: {
    state: string;
    nonce: string;
    codeChallenge: string;
    redirectUri: string;
  }): Promise<URL>;
  exchangeCallback(input: {
    callbackUrl: URL;
    codeVerifier: string;
    expectedState: string;
    expectedNonce: string;
  }): Promise<GoogleIdentity>;
}

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export function createGoogleOAuthProvider(
  credentials: GoogleOAuthCredentials,
): GoogleOAuthProvider {
  let cached: client.Configuration | undefined;
  let loading: Promise<client.Configuration> | undefined;

  async function configuration(): Promise<client.Configuration> {
    if (cached) return cached;
    loading ??= client
      .discovery(GOOGLE_ISSUER, credentials.clientId, credentials.clientSecret)
      .then((config) => {
        cached = config;
        return config;
      })
      .catch((error: unknown) => {
        loading = undefined;
        throw new ExternalServiceError(AUTH_COPY.oauthUnavailable, {
          cause: error,
          exposeDetail: true,
        });
      });
    return loading;
  }

  return {
    async buildAuthorizationUrl(input) {
      const config = await configuration();
      return client.buildAuthorizationUrl(config, {
        redirect_uri: input.redirectUri,
        scope: SCOPES,
        state: input.state,
        nonce: input.nonce,
        code_challenge: input.codeChallenge,
        code_challenge_method: "S256",
      });
    },

    async exchangeCallback(input) {
      try {
        const config = await configuration();
        const tokens = await client.authorizationCodeGrant(config, input.callbackUrl, {
          pkceCodeVerifier: input.codeVerifier,
          expectedState: input.expectedState,
          expectedNonce: input.expectedNonce,
          idTokenExpected: true,
        });
        const claims = tokens.claims();
        if (!claims?.sub || typeof claims.email !== "string") {
          throw new UnauthorizedError(AUTH_COPY.oauthFailed);
        }
        const emailVerified = claims.email_verified === true;
        if (!emailVerified) {
          throw new UnauthorizedError(AUTH_COPY.oauthFailed);
        }
        const displayName =
          typeof claims.name === "string" && claims.name.trim().length > 0
            ? claims.name.trim().slice(0, 100)
            : claims.email.split("@")[0] || "Learner";
        return {
          providerAccountId: claims.sub,
          email: claims.email.trim().toLowerCase(),
          emailVerified: true,
          displayName,
        };
      } catch (error) {
        if (error instanceof UnauthorizedError || error instanceof ExternalServiceError) {
          throw error;
        }
        throw new UnauthorizedError(AUTH_COPY.oauthFailed, { cause: error });
      }
    },
  };
}
