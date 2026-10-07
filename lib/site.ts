// Public site identity used by legal pages, footer and SEO. Fill the NEXT_PUBLIC_* values before launch.
export const siteInfo = {
  name: "mê xem truyện",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  description: "Đọc truyện chữ online: tiên hiệp, huyền huyễn, ngôn tình, đô thị và nhiều thể loại khác.",
  company: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "",
  taxCode: process.env.NEXT_PUBLIC_COMPANY_TAX_CODE ?? "",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "",
};

// Shown on legal pages while company details are still missing, so nobody mistakes a draft for the final text.
export const missingCompanyInfo = !siteInfo.company || !siteInfo.email;
