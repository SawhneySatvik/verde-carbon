import type {
  AuthIdentity,
  AuthPort,
  LinkResult,
  SignInCredential,
} from "@core/ports";

interface MockUser {
  uid: string;
  isAnonymous: boolean;
  displayName?: string;
}

function credentialId(credential: SignInCredential): string {
  return `${credential.provider}:${credential.token}`;
}

/**
 * Credential-free anonymous-first Auth mock (ADR-002). `signInAnonymously`
 * mints a fresh anon uid; a token IS the uid for the local adapter so handlers
 * can resolve identity without any GCP call. `linkWithCredential` simulates
 * Firebase anonymous-account linking:
 *   - happy path: the credential is unused -> the SAME uid is preserved
 *     (no migration), the user becomes non-anonymous.
 *   - conflict: the credential is already bound to another uid -> returns
 *     `credential-already-in-use` with that existing uid so the UI can surface
 *     the keep-vs-merge choice. The anon account is left intact.
 */
export class MockAuthPort implements AuthPort {
  private readonly usersByUid = new Map<string, MockUser>();
  private readonly uidByCredential = new Map<string, string>();
  private counter = 0;

  constructor(seed?: {
    credentials?: ReadonlyArray<{
      credential: SignInCredential;
      uid: string;
      displayName?: string;
    }>;
  }) {
    for (const entry of seed?.credentials ?? []) {
      this.usersByUid.set(entry.uid, {
        uid: entry.uid,
        isAnonymous: false,
        displayName: entry.displayName,
      });
      this.uidByCredential.set(credentialId(entry.credential), entry.uid);
    }
  }

  async signInAnonymously(): Promise<AuthIdentity> {
    this.counter += 1;
    const uid = `anon-${this.counter.toString().padStart(6, "0")}`;
    this.usersByUid.set(uid, { uid, isAnonymous: true });
    return { uid, isAnonymous: true };
  }

  async getCurrentIdentity(token: string): Promise<AuthIdentity | null> {
    const user = this.usersByUid.get(token);
    if (!user) {
      return null;
    }
    return {
      uid: user.uid,
      isAnonymous: user.isAnonymous,
      ...(user.displayName !== undefined && { displayName: user.displayName }),
    };
  }

  async linkWithCredential(
    anonymousUid: string,
    credential: SignInCredential,
  ): Promise<LinkResult> {
    const credId = credentialId(credential);
    const existingUid = this.uidByCredential.get(credId);

    if (existingUid !== undefined && existingUid !== anonymousUid) {
      return { status: "credential-already-in-use", existingUid };
    }

    const user = this.usersByUid.get(anonymousUid) ?? {
      uid: anonymousUid,
      isAnonymous: true,
    };
    const linked: MockUser = {
      uid: user.uid,
      isAnonymous: false,
      displayName: user.displayName,
    };
    this.usersByUid.set(anonymousUid, linked);
    this.uidByCredential.set(credId, anonymousUid);

    return {
      status: "linked",
      identity: {
        uid: linked.uid,
        isAnonymous: false,
        ...(linked.displayName !== undefined && {
          displayName: linked.displayName,
        }),
      },
    };
  }
}
