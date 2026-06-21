import { z } from "zod";
import type { AuthPort, DataPort, MergeSummary } from "@core/ports";
import {
  errors,
  jsonResponse,
  readJsonBody,
  requireIdentity,
  toErrorResponse,
} from "@/server/http";
import { createContainer } from "@/server/container";

/**
 * POST /api/account/link. Links the verified ANONYMOUS caller's account to
 * a sign-in credential via the AuthPort.
 *
 *  - Happy path: the credential is unused -> the SAME uid is preserved (no
 *    migration), the user becomes non-anonymous -> `{ status: "linked" }`.
 *  - Conflict: the credential is already bound to another uid -> we DON'T silently
 *    merge; we surface the keep-vs-merge choice -> `{ status: "credential-already-
 *    in-use", existingUid }`. The anon account is left fully intact.
 *  - Resolution `merge`: copy the anon subcollections into the target uid via the
 *    DataPort's explicit ALL-OR-NOTHING, IDEMPOTENT merge — running it twice must
 *    NOT double-write (the idempotencyKey guard makes a re-run a no-op).
 *  - Resolution `keep` (cancel): no merge; anon data stays intact.
 *
 *  SECURITY: the merge target is NEVER trusted from the client. The merge step
 *  RE-PRESENTS the credential, and the server re-derives the credential's true
 *  owner (`existingUid`) via the AuthPort; the supplied `targetUid` must equal
 *  that server-derived uid or the merge is rejected 403 — so a caller can only
 *  ever merge INTO an account it proved ownership of, never an arbitrary uid.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const credentialSchema = z
  .object({
    provider: z.string().min(1).max(40),
    token: z.string().min(1).max(4_000),
  })
  .strict();

const startLinkSchema = z
  .object({
    action: z.literal("link"),
    credential: credentialSchema,
  })
  .strict();

const keepResolveSchema = z
  .object({
    action: z.literal("resolve"),
    resolution: z.literal("keep"),
  })
  .strict();

// Merge MUST re-present the credential: the target is verified server-side, so a
// client-supplied `targetUid` is never trusted on its own.
const mergeResolveSchema = z
  .object({
    action: z.literal("resolve"),
    resolution: z.literal("merge"),
    credential: credentialSchema,
    targetUid: z.string().min(1).max(128),
    idempotencyKey: z.string().min(1).max(200),
  })
  .strict();

export const accountLinkSchema = z.union([
  startLinkSchema,
  keepResolveSchema,
  mergeResolveSchema,
]);
export type AccountLinkInput = z.infer<typeof accountLinkSchema>;

export type LinkResponse =
  | { status: "linked"; uid: string }
  | {
      status: "credential-already-in-use";
      existingUid: string;
      anonymousUid: string;
    }
  | { status: "merged"; targetUid: string; summary: MergeSummary }
  | { status: "kept"; anonymousUid: string };

export interface AccountLinkDeps {
  auth: AuthPort;
  data: DataPort;
}

async function resolveDeps(): Promise<AccountLinkDeps> {
  const { auth, data } = await createContainer();
  return { auth, data };
}

export async function handlePost(
  req: Request,
  deps: AccountLinkDeps,
): Promise<Response> {
  try {
    const identity = await requireIdentity(req, deps.auth);
    const body = await readJsonBody(req, accountLinkSchema);

    if (body.action === "link") {
      const result = await deps.auth.linkWithCredential(
        identity.uid,
        body.credential,
      );
      if (result.status === "linked") {
        const ok: LinkResponse = { status: "linked", uid: result.identity.uid };
        return jsonResponse(200, ok);
      }
      // Conflict: surface keep-vs-merge; the anon account is untouched.
      const conflict: LinkResponse = {
        status: "credential-already-in-use",
        existingUid: result.existingUid,
        anonymousUid: identity.uid,
      };
      return jsonResponse(409, conflict);
    }

    // action === "resolve"
    if (body.resolution === "keep") {
      const kept: LinkResponse = {
        status: "kept",
        anonymousUid: identity.uid,
      };
      return jsonResponse(200, kept);
    }

    // resolution === "merge". The target is VERIFIED server-side: re-present the
    // credential and re-derive its true owner via the AuthPort. The merge target
    // must equal that server-derived uid — never the raw client-supplied value.
    const verify = await deps.auth.linkWithCredential(
      identity.uid,
      body.credential,
    );
    if (verify.status !== "credential-already-in-use") {
      // The credential is NOT bound to a separate account, so there is nothing to
      // merge into (and no conflict to resolve). Reject rather than trust input.
      throw errors.forbidden(
        "Merge target could not be verified from the presented credential.",
      );
    }
    if (verify.existingUid !== body.targetUid) {
      // Caller tried to merge into a uid they did not prove ownership of.
      throw errors.forbidden(
        "Merge target does not match the credential's verified owner.",
      );
    }

    // Atomic, idempotent merge of anon -> the SERVER-VERIFIED target.
    const summary = await deps.data.mergeUserData(
      identity.uid,
      verify.existingUid,
      body.idempotencyKey,
    );
    const merged: LinkResponse = {
      status: "merged",
      targetUid: verify.existingUid,
      summary,
    };
    return jsonResponse(200, merged);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  return handlePost(req, await resolveDeps());
}
