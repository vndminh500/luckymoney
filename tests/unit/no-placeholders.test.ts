import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("inputs", () => {
  it("have no placeholder text (labels and hints carry the guidance)", () => {
    const offenders = tsxFiles("src").filter((file) =>
      /\splaceholder=["{]/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
