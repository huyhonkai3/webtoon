import "dotenv/config";
import { createPrisma } from "../src/database/prisma.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const prisma = createPrisma(process.env.DATABASE_URL);

const samples = [
  {
    title: "Hành trình bình minh",
    slug: "hanh-trinh-binh-minh",
    description: "Truyện mẫu để kiểm tra luồng web -> API -> PostgreSQL.",
  },
  {
    title: "Thành phố trên mây",
    slug: "thanh-pho-tren-may",
    description: "Dữ liệu minh họa cho bộ nền, chưa có chương truyện.",
  },
];

try {
  for (const sample of samples) {
    await prisma.series.upsert({
      where: {
        slug: sample.slug,
      },

      update: {},

      create: {
        ...sample,
        publicationStatus: "PUBLISHED",
      },
    });
  }
  console.info("Seed hoàn tất: hai truyện mẫu.");
} finally {
  await prisma.$disconnect();
}
