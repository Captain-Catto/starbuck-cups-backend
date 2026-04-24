import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { News, NewsTranslation } from "../models";
import { ResponseHelper } from "../types/api";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";

const SUPPORTED_LOCALES = ["vi", "en", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type TranslationPayload = {
  title?: string;
  summary?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
};

// ─── Public ───────────────────────────────────────────────────────────────────

export const getPublicNewsList = async (req: Request, res: Response) => {
  try {
    const locale = (req.query.locale as string) || "vi";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const offset = (page - 1) * limit;

    const { count, rows } = await News.findAndCountAll({
      where: { status: "published", isDeleted: false },
      include: [
        {
          model: NewsTranslation,
          as: "translations",
          where: { locale },
          required: false,
        },
      ],
      order: [["publishedAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    return res.json(
      ResponseHelper.success({
        items: rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total_pages: totalPages,
          total_items: count,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      })
    );
  } catch (error) {
    logger.error("Get public news list error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to fetch news", "INTERNAL_ERROR"));
  }
};

export const getPublicNewsBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || "vi";

    const news = await News.findOne({
      where: { slug, status: "published", isDeleted: false },
      include: [
        { model: NewsTranslation, as: "translations" },
      ],
    });

    if (!news) {
      return res.status(404).json(ResponseHelper.error("News not found", "NOT_FOUND"));
    }

    // Increment view count without awaiting
    News.increment("viewCount", { where: { id: news.id } }).catch(() => {});

    return res.json(ResponseHelper.success({ news, locale }));
  } catch (error) {
    logger.error("Get public news by slug error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to fetch news", "INTERNAL_ERROR"));
  }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const getAdminNewsList = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { isDeleted: false };
    if (status && ["draft", "published"].includes(status)) where.status = status;

    const { count, rows } = await News.findAndCountAll({
      where,
      include: [
        {
          model: NewsTranslation,
          as: "translations",
          where: search ? { title: { [Op.iLike]: `%${search}%` } } : undefined,
          required: !!search,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return res.json(
      ResponseHelper.success({
        items: rows,
        pagination: {
          current_page: page,
          per_page: limit,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          has_next: page < Math.ceil(count / limit),
          has_prev: page > 1,
        },
      })
    );
  } catch (error) {
    logger.error("Get admin news list error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to fetch news", "INTERNAL_ERROR"));
  }
};

export const getAdminNewsById = async (req: Request, res: Response) => {
  try {
    const news = await News.findOne({
      where: { id: req.params.id, isDeleted: false },
      include: [{ model: NewsTranslation, as: "translations" }],
    });

    if (!news) {
      return res.status(404).json(ResponseHelper.error("News not found", "NOT_FOUND"));
    }

    return res.json(ResponseHelper.success({ news }));
  } catch (error) {
    logger.error("Get admin news by id error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to fetch news", "INTERNAL_ERROR"));
  }
};

export const createNews = async (req: Request, res: Response) => {
  try {
    const { thumbnail, status = "draft", publishedAt, translations = {} } = req.body;
    const adminId = (req as any).admin?.id;

    if (!adminId) {
      return res.status(401).json(ResponseHelper.error("Unauthorized", "UNAUTHORIZED"));
    }

    // Generate slug from Vietnamese title
    const viTitle = translations?.vi?.title;
    if (!viTitle) {
      return res.status(400).json(ResponseHelper.error("Vietnamese title is required", "VALIDATION_ERROR"));
    }

    const baseSlug = generateVietnameseSlug(viTitle);
    let slug = baseSlug;
    let counter = 1;
    while (await News.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const news = await News.create({
      slug,
      thumbnail,
      status,
      publishedAt: status === "published" ? (publishedAt || new Date()) : null,
      viewCount: 0,
      isDeleted: false,
      createdByAdminId: adminId,
    });

    // Upsert translations
    for (const locale of SUPPORTED_LOCALES) {
      const t = translations[locale] as TranslationPayload | undefined;
      if (!t?.title) continue;
      await NewsTranslation.upsert({
        newsId: news.id,
        locale,
        title: t.title,
        summary: t.summary,
        content: t.content,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
      } as any);
    }

    const result = await News.findOne({
      where: { id: news.id },
      include: [{ model: NewsTranslation, as: "translations" }],
    });

    return res.status(201).json(ResponseHelper.success({ news: result }));
  } catch (error) {
    logger.error("Create news error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to create news", "INTERNAL_ERROR"));
  }
};

export const updateNews = async (req: Request, res: Response) => {
  try {
    const news = await News.findOne({ where: { id: req.params.id, isDeleted: false } });
    if (!news) {
      return res.status(404).json(ResponseHelper.error("News not found", "NOT_FOUND"));
    }

    const { thumbnail, status, publishedAt, translations = {} } = req.body;

    await news.update({
      ...(thumbnail !== undefined && { thumbnail }),
      ...(status !== undefined && { status }),
      ...(status === "published" && !news.publishedAt && { publishedAt: publishedAt || new Date() }),
      ...(publishedAt !== undefined && { publishedAt }),
    });

    for (const locale of SUPPORTED_LOCALES) {
      const t = translations[locale] as TranslationPayload | undefined;
      if (!t) continue;
      await NewsTranslation.upsert({
        newsId: news.id,
        locale,
        title: t.title || "",
        summary: t.summary,
        content: t.content,
        metaTitle: t.metaTitle,
        metaDescription: t.metaDescription,
      } as any);
    }

    const result = await News.findOne({
      where: { id: news.id },
      include: [{ model: NewsTranslation, as: "translations" }],
    });

    return res.json(ResponseHelper.success({ news: result }));
  } catch (error) {
    logger.error("Update news error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to update news", "INTERNAL_ERROR"));
  }
};

export const deleteNews = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin?.id;
    const news = await News.findOne({ where: { id: req.params.id, isDeleted: false } });

    if (!news) {
      return res.status(404).json(ResponseHelper.error("News not found", "NOT_FOUND"));
    }

    await news.update({ isDeleted: true, deletedAt: new Date(), deletedByAdminId: adminId });

    return res.json(ResponseHelper.success({ message: "News deleted successfully" }));
  } catch (error) {
    logger.error("Delete news error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to delete news", "INTERNAL_ERROR"));
  }
};

export const toggleNewsStatus = async (req: Request, res: Response) => {
  try {
    const news = await News.findOne({ where: { id: req.params.id, isDeleted: false } });

    if (!news) {
      return res.status(404).json(ResponseHelper.error("News not found", "NOT_FOUND"));
    }

    const newStatus = news.status === "published" ? "draft" : "published";
    await news.update({
      status: newStatus,
      publishedAt: newStatus === "published" && !news.publishedAt ? new Date() : news.publishedAt,
    });

    return res.json(ResponseHelper.success({ news }));
  } catch (error) {
    logger.error("Toggle news status error:", error);
    return res.status(500).json(ResponseHelper.error("Failed to update news status", "INTERNAL_ERROR"));
  }
};
