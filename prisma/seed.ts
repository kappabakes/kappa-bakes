import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

/**
 * Run once with `npx tsx prisma/seed.ts` to get a starting menu and a
 * Saturday/Sunday schedule. Everything here is editable in /admin afterwards.
 */
async function main() {
  // Two lines each — the newline is deliberate and renders as a line break.
  const flavours = [
    {
      name: "Plain Jane",
      description: "Our Signature Classic.\nBurnt To Perfection",
      pricePence: 600,
      hasToppings: false,
      serving: "CHOICE" as const,
      hasExtraSauce: false,
      allergens: ["milk", "eggs", "gluten"],
      image: "/flavours/plain-jane.jpg",
      sortOrder: 0,
    },
    {
      name: "Special K",
      description:
        "Our House Special.\nWhite Chocolate Sauce, Fresh Strawberries & Biscuit Crumble.",
      pricePence: 650,
      hasToppings: true,
      serving: "CHOICE" as const,
      hasExtraSauce: true,
      allergens: ["milk", "eggs", "gluten", "soya"],
      image: "/flavours/special-k.jpg",
      sortOrder: 1,
    },
    {
      name: "The Chocolate One",
      description:
        "Rich Chocolate Sauce.\nMade For The True Chocolate Lovers",
      pricePence: 650,
      hasToppings: true,
      serving: "CHOICE" as const,
      hasExtraSauce: true,
      allergens: ["milk", "eggs", "gluten", "soya"],
      image: "/flavours/chocolate-one.jpg",
      sortOrder: 2,
    },
    {
      name: "Berry Bliss",
      description:
        "White Chocolate Sauce with Raspberry Sauce\nSweet, Smooth & Perfectly Balanced",
      pricePence: 650,
      hasToppings: true,
      serving: "CHOICE" as const,
      hasExtraSauce: true,
      allergens: ["milk", "eggs", "gluten"],
      image: "/flavours/berry-bliss.jpg",
      sortOrder: 3,
    },
  ];



  for (const f of flavours) {
    const exists = await db.flavour.findFirst({ where: { name: f.name } });
    if (exists) {
      // Keep the order and wording right without touching prices, photos or
      // allergens you've since changed.
      await db.flavour.update({
        where: { id: exists.id },
        data: { sortOrder: f.sortOrder, description: f.description },
      });
    } else {
      await db.flavour.create({ data: f });
    }
  }

  for (const weekday of [6, 0]) {
    await db.recurringSlot.upsert({
      where: { weekday },
      create: {
        weekday,
        capacity: 32,
        startTime: "2:00 PM",
        endTime: "4:00 PM",
        active: true,
      },
      update: {},
    });
  }

  console.log("Seeded. Open /admin to confirm your dates.");
}

main().finally(() => db.$disconnect());
