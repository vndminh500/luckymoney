import { notFound } from "next/navigation";
import { describe, expect, it } from "vitest";

import { ValidationError } from "@/server/errors";
import { errorResponse } from "@/server/http";

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

describe("errorResponse", () => {
  it("maps app errors to their JSON response", async () => {
    const response = errorResponse(new ValidationError([{ field: "amount", message: "x" }]));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "VALIDATION_ERROR",
      details: [{ field: "amount", message: "x" }],
    });
  });

  it("rethrows Next.js control-flow errors instead of turning them into a 500", () => {
    // Same mechanism as the prerender bail-out of connection(): Next.js must see it.
    const signal = thrown(() => notFound());
    expect(() => errorResponse(signal)).toThrow(signal as Error);
  });
});
