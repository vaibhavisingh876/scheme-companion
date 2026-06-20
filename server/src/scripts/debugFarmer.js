// scripts/debugFarmers.js create kar:
import prisma from "../src/config/prisma.js";

const farmers = await prisma.scheme.findMany({
  where: {
    isActive: true,
    OR: [
      { allowedOccupations: { has: "farmer" } },
      { allowedOccupations: { has: "all" } },
      { allowedOccupations: { isEmpty: true } }
    ],
    OR: [
      { allowedStates: { has: "uttarpradesh" } },
      { allowedStates: { has: "all" } },
      { allowedStates: { isEmpty: true } }
    ]
  },
  select: {
    id: true,
    name: true,
    allowedOccupations: true,
    allowedStates: true,
    category: true
  }
});

console.log("Farmer Schemes Found:", farmers.length);
console.log(farmers);