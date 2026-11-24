/**
 * Icons for categories, grouped by everyday activities (Vietnamese labels).
 * The picker shows these; the API still accepts any short icon text.
 */

export type CategoryIcon = { emoji: string; label: string };
export type CategoryIconGroup = { label: string; icons: CategoryIcon[] };

export const CATEGORY_ICON_GROUPS: CategoryIconGroup[] = [
  {
    label: "Ăn uống",
    icons: [
      { emoji: "🍜", label: "Phở, bún" },
      { emoji: "🍚", label: "Cơm" },
      { emoji: "🥖", label: "Bánh mì" },
      { emoji: "☕", label: "Cà phê" },
      { emoji: "🧋", label: "Trà sữa" },
      { emoji: "🍺", label: "Bia, nhậu" },
      { emoji: "🍲", label: "Lẩu" },
      { emoji: "🍰", label: "Bánh ngọt" },
      { emoji: "🍎", label: "Trái cây" },
      { emoji: "🛒", label: "Đi chợ, siêu thị" },
    ],
  },
  {
    label: "Đi lại",
    icons: [
      { emoji: "🛵", label: "Xe máy" },
      { emoji: "⛽", label: "Xăng" },
      { emoji: "🚗", label: "Ô tô" },
      { emoji: "🚕", label: "Taxi, xe công nghệ" },
      { emoji: "🚌", label: "Xe buýt" },
      { emoji: "🚆", label: "Tàu" },
      { emoji: "✈️", label: "Máy bay" },
      { emoji: "🅿️", label: "Gửi xe" },
      { emoji: "🔧", label: "Sửa xe" },
    ],
  },
  {
    label: "Nhà ở",
    icons: [
      { emoji: "🏠", label: "Tiền nhà" },
      { emoji: "💡", label: "Tiền điện" },
      { emoji: "🚰", label: "Tiền nước" },
      { emoji: "📶", label: "Internet" },
      { emoji: "📞", label: "Điện thoại" },
      { emoji: "🧺", label: "Giặt ủi" },
      { emoji: "🧹", label: "Dọn dẹp" },
      { emoji: "🛋️", label: "Đồ gia dụng" },
    ],
  },
  {
    label: "Mua sắm",
    icons: [
      { emoji: "🛍️", label: "Mua sắm" },
      { emoji: "👕", label: "Quần áo" },
      { emoji: "👟", label: "Giày dép" },
      { emoji: "💄", label: "Mỹ phẩm" },
      { emoji: "📱", label: "Điện tử" },
      { emoji: "🎁", label: "Quà tặng" },
      { emoji: "📦", label: "Đồ khác" },
    ],
  },
  {
    label: "Sức khỏe",
    icons: [
      { emoji: "💊", label: "Thuốc" },
      { emoji: "🏥", label: "Khám bệnh" },
      { emoji: "🦷", label: "Nha khoa" },
      { emoji: "🏋️", label: "Tập gym" },
      { emoji: "🧘", label: "Yoga, thư giãn" },
      { emoji: "💇", label: "Cắt tóc, làm đẹp" },
    ],
  },
  {
    label: "Học tập",
    icons: [
      { emoji: "📚", label: "Sách" },
      { emoji: "🎓", label: "Học phí" },
      { emoji: "✏️", label: "Văn phòng phẩm" },
      { emoji: "💻", label: "Khóa học online" },
    ],
  },
  {
    label: "Giải trí",
    icons: [
      { emoji: "🎮", label: "Trò chơi" },
      { emoji: "🎬", label: "Xem phim" },
      { emoji: "🎵", label: "Âm nhạc" },
      { emoji: "📺", label: "Ứng dụng xem phim" },
      { emoji: "⚽", label: "Thể thao" },
      { emoji: "🏖️", label: "Du lịch" },
      { emoji: "🎤", label: "Karaoke" },
    ],
  },
  {
    label: "Gia đình",
    icons: [
      { emoji: "👶", label: "Con cái" },
      { emoji: "🐶", label: "Thú cưng" },
      { emoji: "👪", label: "Gia đình" },
      { emoji: "💐", label: "Hoa, hiếu hỉ" },
      { emoji: "🧧", label: "Lì xì" },
      { emoji: "🙏", label: "Từ thiện" },
    ],
  },
  {
    label: "Thu nhập",
    icons: [
      { emoji: "💼", label: "Lương" },
      { emoji: "💰", label: "Tiền mặt" },
      { emoji: "🏆", label: "Thưởng" },
      { emoji: "📈", label: "Đầu tư" },
      { emoji: "🏦", label: "Lãi tiết kiệm" },
      { emoji: "🛠️", label: "Việc làm thêm" },
      { emoji: "💸", label: "Hoàn tiền" },
    ],
  },
  {
    label: "Tài chính",
    icons: [
      { emoji: "💳", label: "Thẻ tín dụng" },
      { emoji: "🧾", label: "Hóa đơn" },
      { emoji: "🛡️", label: "Bảo hiểm" },
      { emoji: "🏛️", label: "Thuế, phí" },
    ],
  },
];

/** Lowercase and strip Vietnamese diacritics, so "ca phe" finds "Cà phê". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** Groups whose name or icons match the query; icons of a matching group all stay. */
export function searchIcons(query: string): CategoryIconGroup[] {
  const q = fold(query);
  if (q === "") {
    return CATEGORY_ICON_GROUPS;
  }
  return CATEGORY_ICON_GROUPS.flatMap((group) => {
    if (fold(group.label).includes(q)) {
      return [group];
    }
    const icons = group.icons.filter((icon) => fold(icon.label).includes(q));
    return icons.length > 0 ? [{ ...group, icons }] : [];
  });
}

/** The label of a known icon, or null for a custom one. */
export function findIconLabel(emoji: string | null): string | null {
  if (!emoji) return null;
  for (const group of CATEGORY_ICON_GROUPS) {
    const found = group.icons.find((icon) => icon.emoji === emoji);
    if (found) return found.label;
  }
  return null;
}
