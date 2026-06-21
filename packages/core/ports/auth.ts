export interface AuthIdentity {
  uid: string;
  isAnonymous: boolean;
  displayName?: string;
}

export type LinkResult =
  | { status: "linked"; identity: AuthIdentity }
  | { status: "credential-already-in-use"; existingUid: string };

export interface SignInCredential {
  provider: string;
  token: string;
}

export interface AuthPort {
  signInAnonymously(): Promise<AuthIdentity>;
  getCurrentIdentity(token: string): Promise<AuthIdentity | null>;
  linkWithCredential(
    anonymousUid: string,
    credential: SignInCredential,
  ): Promise<LinkResult>;
}
