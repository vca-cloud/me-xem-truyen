export type AdminGenre = {
  name: string;
  slug: string;
  stories: number;
  views: string;
  color: string;
};

export const adminStories = [
  { title: "Thiên Đạo Đồ Thư Quán", author: "Khô Lâu Tinh Linh", genre: "Tiên Hiệp", chapters: "3.422", status: "Đang ra", updated: "12 phút trước" },
  { title: "Đấu Phá Thương Khung", author: "Thiên Tằm Thổ Đậu", genre: "Huyền Huyễn", chapters: "1.891", status: "Đang ra", updated: "35 phút trước" },
  { title: "Toàn Chức Pháp Sư", author: "Loạn", genre: "Đô Thị", chapters: "2.986", status: "Đang ra", updated: "1 giờ trước" },
  { title: "Đế Bá", author: "Nguyệt Như Hỏa", genre: "Kiếm Hiệp", chapters: "4.200", status: "Hoàn thành", updated: "3 giờ trước" },
  { title: "Ngã Là Đại Thần Tiên", author: "Mạc Mặc", genre: "Võng Du", chapters: "556", status: "Tạm dừng", updated: "Hôm qua" },
  { title: "Mạt Thế Chi Vương", author: "Dạ Hành Nguyệt", genre: "Mạt Thế", chapters: "1.323", status: "Đang ra", updated: "Hôm qua" },
];

export const adminMembers = [
  { name: "Nguyễn Minh Anh", email: "minhanh@gmail.com", joined: "12/03/2024", stories: 28, status: "Hoạt động" },
  { name: "Trần Quốc Huy", email: "quochuy@icloud.com", joined: "10/03/2024", stories: 14, status: "Hoạt động" },
  { name: "Lê Hoàng Nam", email: "hoangnam@gmail.com", joined: "08/03/2024", stories: 7, status: "Hoạt động" },
  { name: "Phạm Thùy Linh", email: "thuylinh@gmail.com", joined: "05/03/2024", stories: 42, status: "Bị khóa" },
  { name: "Đỗ Gia Bảo", email: "giabao@outlook.com", joined: "01/03/2024", stories: 3, status: "Hoạt động" },
];

export const adminGenres: AdminGenre[] = [
  { name: "Tiên Hiệp", slug: "tien-hiep", stories: 284, views: "1.2M", color: "bg-violet-100 text-violet-700" },
  { name: "Huyền Huyễn", slug: "huyen-huyen", stories: 241, views: "980K", color: "bg-blue-100 text-blue-700" },
  { name: "Ngôn Tình", slug: "ngon-tinh", stories: 198, views: "864K", color: "bg-pink-100 text-pink-700" },
  { name: "Kiếm Hiệp", slug: "kiem-hiep", stories: 156, views: "532K", color: "bg-amber-100 text-amber-700" },
  { name: "Đô Thị", slug: "do-thi", stories: 143, views: "498K", color: "bg-emerald-100 text-emerald-700" },
];

export const genreNames = adminGenres.map((genre) => genre.name);
