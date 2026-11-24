/** Initials for the fallback avatar: first letters of the first and last word. */
export function initialsOf(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return email.slice(0, 1).toUpperCase();
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

type Props = {
  name: string | null;
  email: string;
  avatarVersion: number | null;
  /** Tailwind size and text classes, e.g. "size-10 text-sm". */
  className?: string;
};

/** Square avatar: the uploaded image, or the initials on the brand gradient. */
export function UserAvatar({ name, email, avatarVersion, className = "size-10 text-sm" }: Props) {
  if (avatarVersion !== null) {
    return (
      // A plain <img>: the image is private and per user, so next/image's
      // shared optimisation cache does not apply.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/account/avatar?v=${avatarVersion}`}
        alt=""
        className={`${className} shrink-0 rounded-xl object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lm-sky to-lm-aqua font-bold text-lm-ink`}
    >
      {initialsOf(name, email)}
    </span>
  );
}
