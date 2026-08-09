import prisma from "../config/prisma.js";
import { buildSchemeFilters } from "../services/filterBuilder.js";

// ⚠️ Agar tumhare paas pehle se koi aur exports the
// (jaise getSchemeById, createScheme, etc.), to unhe yahan rakhna.
// Sirf searchSchemes aur getAllSchemes yahan diye gaye hain.

/**
 * GET /api/schemes — paginated list of all active schemes
 */
export const getAllSchemes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 100));
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
 * Uses buildSchemeFilters for consistency with AI recommendations.
 * Response format frontend ke hisaab se hai.
 */
export const searchSchemes = async (req, res) => {
  try {
    const { gender, state, occupation, educationLevel, income, casteCategory } = req.body;

    const profile = { gender, state, occupation, educationLevel, income, casteCategory };
    // strictOccupation: true — optional, agar tum hard occupation filter chahte ho
    const where = buildSchemeFilters(profile, { strictOccupation: true });

    const schemes = await prisma.scheme.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        benefits: true,
        eligibility: true,
        category: true,
        ministry: true,
        state: true,
        applicationLink: true,
        sourceUrl: true,
        tags: true,
        allowedOccupations: true,
        allowedStates: true,
        isFemaleOnly: true,
        schemeFor: true,
        occupation: true,
        educationLevel: true,
        minIncome: true,
        maxIncome: true,
        minAge: true,
        maxAge: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // maximum results
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

// 🚫 searchSchemesManual function HATA DIYA GAYA — uski zaroorat nahi.
// Sirf upar wala searchSchemes manual search ke liye kaafi hai.