import { connection } from "next/server";

import { assetLinks } from "@/server/android/asset-links";

/**
 * Digital Asset Links: tells Android that the APK signed with these
 * certificates may open this site full screen (Trusted Web Activity), without
 * the browser's address bar. Values come from the APK build (PWABuilder):
 * ANDROID_PACKAGE_NAME and ANDROID_CERT_SHA256 (comma-separated fingerprints).
 * Without them the list is empty and the app still works, with an address bar.
 */
export async function GET(): Promise<Response> {
  // Read the environment per request, not at build time.
  await connection();
  return Response.json(assetLinks(process.env));
}
