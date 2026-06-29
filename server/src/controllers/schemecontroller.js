import prisma from "../config/prisma.js";

/**
 * GET /api/schemes — paginated list of all active schemes
 */
export const getAllSchemes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page,10) || 1);
    const limit = Math.max(
  1,
  Math.min(parseInt(req.query.limit,10) || 50,100)
);
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
    console.error("getAllSchemes Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load schemes.",
      schemes: [],
      count: 0,
    });
  }
};

/**
 * POST /api/schemes/search — manual filter search
 *
 * FIX: Removed `{ allowedXxx: { isEmpty: true } }` from every OR block.
 * That fallback caused schemes with no data in those fields to match every
 * single query, flooding results with irrelevant schemes.
 * Now only schemes that explicitly allow "all" or the specific value match.
 */
export const searchSchemes = async (req, res) => {
  try {
    const { gender, state, occupation, educationLevel, income, casteCategory } = req.body;

    const andConditions = [{ isActive: true }];

    if (gender) {
      andConditions.push({
        OR: [
          { allowedGenders: { has: gender } },
          { allowedGenders: { has: "all" } },
        ],
      });
    }

    if (state && state !== "All India" && state !== "unknown") {
      const normalizedState = state.toLowerCase().replace(/\s/g, "");
      andConditions.push({
        OR: [
          { allowedStates: { has: "all" } },
          { allowedStates: { has: normalizedState } },
        ],
      });
    }

    if (occupation) {
      andConditions.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }

    if (educationLevel) {
      andConditions.push({
        OR: [
          { allowedEducationLevels: { has: educationLevel } },
          { allowedEducationLevels: { has: "all" } },
        ],
      });
    }

    if (income !== undefined && income !== null) {
      const targetIncome = parseInt(income, 10);
      if (!isNaN(targetIncome)) {
        andConditions.push({
          AND: [
            { OR: [{ maxIncome: null }, { maxIncome: { gte: targetIncome } }] },
            { OR: [{ minIncome: null }, { minIncome: { lte: targetIncome } }] },
          ],
        });
      }
    }

    if (casteCategory) {
      andConditions.push({
        OR: [
          { allowedCategories: { has: casteCategory } },
          { allowedCategories: { has: "general" } },
        ],
      });
    }

    const schemes = await prisma.scheme.findMany({
      where: { AND: andConditions },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      schemes,
      count: schemes.length,
    });
  } catch (error) {
    console.error("searchSchemes Error:", error);
    return res.status(500).json({
      success: false,
      message: "Search failed. Please try again.",
      schemes: [],
      count: 0,
    });
  }
};