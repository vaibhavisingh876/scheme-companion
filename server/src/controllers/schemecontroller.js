import prisma from "../config/prisma.js";

/**
 * 📄 GET ALL SCHEMES (WITH PAGINATION)
 */
export const getAllSchemes = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;

    const [schemes, total] = await prisma.$transaction([
      prisma.scheme.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.scheme.count({ where: { isActive: true } }),
    ]);

    return res.status(200).json({
      success: true,
      profile: null,
      schemes,
      count: schemes.length,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch Execution Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load scheme repository items.",
      profile: null,
      schemes: [],
      count: 0,
    });
  }
};

/**
 * 🔍 SEARCH SCHEMES (MANUAL FILTER MODE)
 */
export const searchSchemes = async (req, res) => {
  try {
    const {
      gender,
      state,
      occupation,
      educationLevel,
      income,
      casteCategory,
    } = req.body;

    const andConditions = [{ isActive: true }];

    // 1. Gender filter — use allowedGenders array (robust) not scalar gender field
    if (gender) {
      andConditions.push({
        OR: [
          { allowedGenders: { has: gender } },
          { allowedGenders: { has: "all" } },
          { allowedGenders: { isEmpty: true } },
        ],
      });
    }

    // 2. State filter — use allowedStates array (robust) not scalar state field.
    // Includes "all" for central government schemes.
    if (state && state !== "All India" && state !== "unknown") {
      const normalizedState = state.toLowerCase().replace(/\s/g, "");
      andConditions.push({
        OR: [
          { allowedStates: { isEmpty: true } },
          { allowedStates: { has: "all" } },
          { allowedStates: { has: normalizedState } },
        ],
      });
    }

    // 3. Occupation filter — use allowedOccupations array (robust)
    if (occupation) {
      andConditions.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } },
          { allowedOccupations: { isEmpty: true } },
        ],
      });
    }

    // 4. Education level filter — use allowedEducationLevels array (robust)
    if (educationLevel) {
      andConditions.push({
        OR: [
          { allowedEducationLevels: { has: educationLevel } },
          { allowedEducationLevels: { has: "all" } },
          { allowedEducationLevels: { isEmpty: true } },
        ],
      });
    }

    // 5. Income filter
    if (income) {
      const targetIncome = parseInt(income, 10);
      andConditions.push({
        AND: [
          { OR: [{ maxIncome: null }, { maxIncome: { gte: targetIncome } }] },
          { OR: [{ minIncome: null }, { minIncome: { lte: targetIncome } }] },
        ],
      });
    }

    // 6. Caste category filter
    if (casteCategory) {
      andConditions.push({
        OR: [
          { allowedCategories: { has: casteCategory } },
          { allowedCategories: { has: "general" } },
          { allowedCategories: { isEmpty: true } },
        ],
      });
    }

    const schemes = await prisma.scheme.findMany({
      where: { AND: andConditions },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      profile: null,
      schemes,
      count: schemes.length,
    });
  } catch (error) {
    console.error("Query Execution Exception:", error);
    return res.status(500).json({
      success: false,
      message: "Processing data filter structures encountered exceptions.",
      profile: null,
      schemes: [],
      count: 0,
    });
  }
};