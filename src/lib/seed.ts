import { seedOnlineMsme } from "./seed-online-msme";

export async function seedDatabase() {
  return await seedOnlineMsme();
}
