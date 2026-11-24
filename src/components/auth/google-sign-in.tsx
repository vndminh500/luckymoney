import { googleSignInAction } from "@/app/(auth)/actions";

/** "Continue with Google" button plus an "or" divider. Server component, works without JS. */
export function GoogleSignIn({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <>
      <form action={googleSignInAction}>
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] px-4 font-medium text-[var(--auth-text)] transition-[border-color,box-shadow,transform] duration-200 ease-lm hover:border-lm-sky hover:shadow-[0_6px_16px_rgb(48_175_255/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lm-deep active:scale-[0.98]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          Tiếp tục với Google
        </button>
      </form>
      <div className="my-6 flex items-center gap-3 text-sm text-[var(--auth-muted)]">
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
        hoặc dùng email
        <span className="h-px flex-1 bg-[var(--auth-border)]" />
      </div>
    </>
  );
}
