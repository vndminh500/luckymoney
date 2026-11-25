/** One Digital Asset Links statement (https://developers.google.com/digital-asset-links). */
export type AssetLink = {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
};

/** The statements for /.well-known/assetlinks.json; empty until the APK values are set. */
export function assetLinks(env: Record<string, string | undefined>): AssetLink[] {
  const packageName = env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  if (!packageName || fingerprints.length === 0) {
    return [];
  }
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
