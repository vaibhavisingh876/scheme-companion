import prisma from "../config/prisma.js";

export const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: req.user.userId,
      },
      include: {
        scheme: true,
      },
    });

    return res.json(bookmarks.map((b) => b.scheme));
  } catch (error) {
    console.error("Get Bookmarks Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookmarks.",
    });
  }
};

export const addBookmark = async (req, res) => {
  const { schemeId } = req.body;

  try {
    if (!schemeId) {
      return res.status(400).json({
        success: false,
        message: "Scheme ID is required.",
      });
    }

    const existing = await prisma.bookmark.findFirst({
      where: {
        userId: req.user.userId,
        schemeId,
      },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Already bookmarked.",
      });
    }

    await prisma.bookmark.create({
      data: {
        userId: req.user.userId,
        schemeId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Scheme bookmarked successfully.",
    });
  } catch (error) {
    console.error("Add Bookmark Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to bookmark scheme.",
    });
  }
};

export const removeBookmark = async (req, res) => {
  const { schemeId } = req.params;

  try {
    await prisma.bookmark.deleteMany({
      where: {
        userId: req.user.userId,
        schemeId,
      },
    });

    return res.json({
      success: true,
      message: "Bookmark removed successfully.",
    });
  } catch (error) {
    console.error("Remove Bookmark Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove bookmark.",
    });
  }
};