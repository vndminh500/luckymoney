import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Không tìm thấy</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Trang hoặc giao dịch này không tồn tại, hoặc đã bị xóa.
      </p>
      <Link
        href="/transactions"
        className="font-medium text-emerald-800 underline dark:text-emerald-400"
      >
        Về danh sách giao dịch
      </Link>
    </main>
  );
}
