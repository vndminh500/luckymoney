import type { Metadata } from "next";

import { LogoMark } from "@/components/brand/logo";
import { SettingsCard } from "@/components/settings/choice-group";

import packageJson from "../../../../../package.json";

export const metadata: Metadata = { title: "Về ứng dụng" };

const FEATURES = [
  "Ghi thu chi nhanh, gõ số tiền kiểu 50k hay 1tr5",
  "Tổng quan tháng, thống kê theo tuần, tháng, năm",
  "Ngân sách theo danh mục, cảnh báo ở 80% và 100%",
  "Danh mục riêng: thêm, sửa, xóa, chọn biểu tượng",
];

export default function AboutPage() {
  return (
    <>
      <SettingsCard title="Về ứng dụng">
        <div className="flex items-center gap-4">
          <LogoMark className="size-16" />
          <div>
            <p className="text-xl font-bold">Lucky Money</p>
            <p className="text-[var(--dash-muted)]">Phiên bản {packageJson.version}</p>
          </div>
        </div>
        <p className="mt-5">
          Ứng dụng quản lý chi tiêu cá nhân: ghi lại từng khoản thu chi và biết tiền của bạn đi đâu
          mỗi tháng.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-lm-sky" />
              {feature}
            </li>
          ))}
        </ul>
      </SettingsCard>
      <SettingsCard title="Dữ liệu của bạn">
        <ul className="flex flex-col gap-2 text-[var(--dash-muted)]">
          <li>Chỉ bạn xem được giao dịch, danh mục, ngân sách và ảnh đại diện của mình.</li>
          <li>Mật khẩu được băm bằng scrypt, không lưu ở dạng đọc được.</li>
          <li>Giao dịch đã xóa được ẩn khỏi danh sách và thống kê.</li>
        </ul>
      </SettingsCard>
    </>
  );
}
