import { describe, expect, it } from "vitest";

import { CATEGORY_ICON_GROUPS, findIconLabel, searchIcons } from "@/lib/category-icons";
import { CATEGORY_ICON_MAX_LENGTH } from "@/lib/schemas/category";
import { DEFAULT_CATEGORIES } from "@/server/categories/defaults";

const all = CATEGORY_ICON_GROUPS.flatMap((group) => group.icons);

describe("category icons", () => {
  it("are unique and fit the icon column", () => {
    const emojis = all.map((icon) => icon.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
    for (const emoji of emojis) {
      expect(emoji.length).toBeLessThanOrEqual(CATEGORY_ICON_MAX_LENGTH);
    }
  });

  it("include every default category's icon, so the picker can show it as chosen", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(findIconLabel(category.icon)).not.toBeNull();
    }
  });
});

describe("searchIcons", () => {
  it("returns every group for an empty query", () => {
    expect(searchIcons("")).toEqual(CATEGORY_ICON_GROUPS);
  });

  it("matches labels with or without Vietnamese diacritics, any case", () => {
    const withMarks = searchIcons("cà phê").flatMap((group) => group.icons);
    const without = searchIcons("CA PHE").flatMap((group) => group.icons);
    expect(withMarks.map((icon) => icon.emoji)).toContain("☕");
    expect(without).toEqual(withMarks);
  });

  it("matches the group name too, and drops empty groups", () => {
    const groups = searchIcons("đi lại");
    expect(groups.map((group) => group.label)).toEqual(["Đi lại"]);
    expect(groups[0].icons.length).toBeGreaterThan(3);
  });

  it("finds nothing for an unrelated word", () => {
    expect(searchIcons("xyzxyz")).toEqual([]);
  });
});
