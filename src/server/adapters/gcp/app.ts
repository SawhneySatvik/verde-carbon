import {
  type App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

let cached: App | undefined;

export interface GcpAppOptions {
  projectId?: string;
  /**
   * Optional service-account JSON (resolved via SecretsPort in callers). When
   * absent, Application Default Credentials are used (the Cloud Run runtime
   * service account), so no key material lives in source or env literals.
   */
  serviceAccountJson?: string;
}

/**
 * Lazily initialize (once) and return the firebase-admin App. Constructed only
 * when a GCP adapter is actually instantiated — never in local mode.
 */
export function getAdminApp(options: GcpAppOptions = {}): App {
  if (cached) {
    return cached;
  }
  const existing = getApps();
  if (existing.length > 0) {
    cached = existing[0];
    return cached;
  }

  const credential = options.serviceAccountJson
    ? cert(JSON.parse(options.serviceAccountJson) as object)
    : applicationDefault();

  cached = initializeApp({
    credential,
    ...(options.projectId !== undefined && { projectId: options.projectId }),
  });
  return cached;
}
