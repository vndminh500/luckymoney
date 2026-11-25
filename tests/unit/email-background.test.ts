import { describe, expect, it, vi } from "vitest";

import { sendInBackground } from "@/server/email/background";
import type { Email, SendEmail } from "@/server/email/mailer";

const email: Email = { to: "an@example.com", subject: "S", text: "T", html: "<p>T</p>" };

function scheduler(): { schedule: (task: () => Promise<void>) => void; run: () => Promise<void> } {
  const tasks: Array<() => Promise<void>> = [];
  return {
    schedule: (task) => {
      tasks.push(task);
    },
    run: async () => {
      for (const task of tasks.splice(0)) await task();
    },
  };
}

describe("sendInBackground", () => {
  it("resolves at once and leaves the sending to the scheduled task", async () => {
    const send = vi.fn<SendEmail>(() => new Promise(() => undefined)); // a hanging SMTP server
    const { schedule } = scheduler();

    await expect(sendInBackground(send, schedule)(email)).resolves.toBe(undefined);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the email when the scheduled task runs", async () => {
    const send = vi.fn<SendEmail>(async () => undefined);
    const { schedule, run } = scheduler();

    await sendInBackground(send, schedule)(email);
    await run();

    expect(send).toHaveBeenCalledWith(email);
  });

  it("logs a failed send instead of throwing", async () => {
    const send = vi.fn<SendEmail>(async () => {
      throw new Error("SMTP down");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { schedule, run } = scheduler();

    await sendInBackground(send, schedule)(email);
    await expect(run()).resolves.toBe(undefined);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
