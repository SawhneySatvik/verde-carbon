import { type Auth, type DecodedIdToken, getAuth } from "firebase-admin/auth";
import type {
  AuthIdentity,
  AuthPort,
  LinkResult,
  SignInCredential,
} from "@core/ports";
import { getAdminApp, type GcpAppOptions } from "./app";

interface FirebaseAuthError {
  code?: string;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return (error as FirebaseAuthError).code;
  }
  return undefined;
}

function claimString(
  decoded: DecodedIdToken,
  claim: string,
): string | undefined {
  const value: unknown = (decoded as Record<string, unknown>)[claim];
  return typeof value === "string" ? value : undefined;
}

function identityFromDecoded(decoded: DecodedIdToken): AuthIdentity {
  const isAnonymous = decoded.firebase.sign_in_provider === "anonymous";
  const name = claimString(decoded, "name");
  return {
    uid: decoded.uid,
    isAnonymous,
    ...(name !== undefined && { displayName: name }),
  };
}

/**
 * Firebase Auth adapter (ADR-002). Anonymous-first: the actual
 * `signInAnonymously` / `linkWithCredential` happen in the browser SDK and
 * preserve the uid (no migration on the happy path). Server-side this adapter
 * (a) mints the anonymous user + a custom token, (b) verifies ID tokens to
 * resolve the current identity, and (c) on link resolves the
 * `credential-already-in-use` conflict by looking up whether the credential's
 * provider uid already belongs to a DIFFERENT account, so the UI can surface the
 * keep-vs-merge choice. The anonymous account is never silently overwritten.
 */
export class FirebaseAuthPort implements AuthPort {
  private readonly auth: Auth;

  constructor(appOptions: GcpAppOptions = {}, auth?: Auth) {
    this.auth = auth ?? getAuth(getAdminApp(appOptions));
  }

  async signInAnonymously(): Promise<AuthIdentity> {
    const user = await this.auth.createUser({});
    return { uid: user.uid, isAnonymous: true };
  }

  async getCurrentIdentity(token: string): Promise<AuthIdentity | null> {
    try {
      const decoded = await this.auth.verifyIdToken(token);
      return identityFromDecoded(decoded);
    } catch {
      return null;
    }
  }

  async linkWithCredential(
    anonymousUid: string,
    credential: SignInCredential,
  ): Promise<LinkResult> {
    try {
      const existing = await this.auth.getUserByProviderUid(
        credential.provider,
        credential.token,
      );
      if (existing.uid !== anonymousUid) {
        return {
          status: "credential-already-in-use",
          existingUid: existing.uid,
        };
      }
    } catch (error) {
      if (errorCode(error) !== "auth/user-not-found") {
        throw error;
      }
      // No existing account owns this credential — the link can proceed.
    }

    const updated = await this.auth.updateUser(anonymousUid, {
      providerToLink: {
        providerId: credential.provider,
        uid: credential.token,
      },
    });
    return {
      status: "linked",
      identity: {
        uid: updated.uid,
        isAnonymous: false,
        ...(updated.displayName !== undefined && {
          displayName: updated.displayName,
        }),
      },
    };
  }
}
