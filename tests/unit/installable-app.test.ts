import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { assetLinks } from "@/server/android/asset-links";

const FINGERPRINT = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0"))
  .join(":")
  .toUpperCase();

describe("web app manifest", () => {
  const data = manifest();

  it("opens the app standalone from the home page", () => {
    expect(data).toMatchObject({
      name: "Lucky Money",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
  });

  it("has 192 and 512 icons, plain and maskable, that exist in /public", () => {
    const icons = data.icons ?? [];
    for (const purpose of ["any", "maskable"]) {
      const sizes = icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes);
      expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    }
    for (const icon of icons) {
      expect(existsSync(join("public", icon.src))).toBe(true);
    }
  });
});

describe("assetLinks", () => {
  it("is empty until the Android package and fingerprint are configured", () => {
    expect(assetLinks({})).toEqual([]);
    expect(assetLinks({ ANDROID_PACKAGE_NAME: "app.lucky" })).toEqual([]);
    expect(assetLinks({ ANDROID_CERT_SHA256: FINGERPRINT })).toEqual([]);
  });

  it("links the package to every valid fingerprint, normalised to upper case", () => {
    const links = assetLinks({
      ANDROID_PACKAGE_NAME: " app.lucky.twa ",
      ANDROID_CERT_SHA256: `${FINGERPRINT.toLowerCase()}, not-a-fingerprint`,
    });
    expect(links).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.lucky.twa",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ]);
  });
});
