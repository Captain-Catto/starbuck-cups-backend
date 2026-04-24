import { DataTypes, Model, Sequelize } from "sequelize";

export type NewsLocale = "vi" | "en" | "zh";

export interface NewsTranslationAttributes {
  id: string;
  newsId: string;
  locale: NewsLocale;
  title: string;
  summary?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsTranslationCreationAttributes
  extends Omit<NewsTranslationAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class NewsTranslation
  extends Model<NewsTranslationAttributes, NewsTranslationCreationAttributes>
  implements NewsTranslationAttributes
{
  declare id: string;
  declare newsId: string;
  declare locale: NewsLocale;
  declare title: string;
  declare summary?: string;
  declare content?: string;
  declare metaTitle?: string;
  declare metaDescription?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  declare news?: any;

  static associate(models: any) {
    NewsTranslation.belongsTo(models.News, {
      foreignKey: "newsId",
      as: "news",
      onDelete: "CASCADE",
    });
  }
}

export const NewsTranslationModel = (sequelize: Sequelize) => {
  NewsTranslation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      newsId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "news_id",
      },
      locale: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(300),
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metaTitle: {
        type: DataTypes.STRING(300),
        allowNull: true,
        field: "meta_title",
      },
      metaDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "meta_description",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "NewsTranslation",
      tableName: "news_translations",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          unique: true,
          fields: ["news_id", "locale"],
          name: "uq_news_translations_news_locale",
        },
      ],
    }
  );

  return NewsTranslation;
};
