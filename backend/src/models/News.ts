import { DataTypes, Model, Sequelize } from "sequelize";

export type NewsStatus = "draft" | "published";

export interface NewsAttributes {
  id: string;
  slug: string;
  thumbnail?: string;
  status: NewsStatus;
  publishedAt?: Date | null;
  viewCount: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedByAdminId?: string | null;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsCreationAttributes
  extends Omit<NewsAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class News
  extends Model<NewsAttributes, NewsCreationAttributes>
  implements NewsAttributes
{
  declare id: string;
  declare slug: string;
  declare thumbnail?: string;
  declare status: NewsStatus;
  declare publishedAt?: Date | null;
  declare viewCount: number;
  declare isDeleted: boolean;
  declare deletedAt?: Date | null;
  declare deletedByAdminId?: string | null;
  declare createdByAdminId: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  declare translations?: any[];
  declare createdByAdmin?: any;

  static associate(models: any) {
    News.hasMany(models.NewsTranslation, {
      foreignKey: "newsId",
      as: "translations",
      onDelete: "CASCADE",
    });
    News.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
  }
}

export const NewsModel = (sequelize: Sequelize) => {
  News.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING(300),
        allowNull: false,
        unique: true,
      },
      thumbnail: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("draft", "published"),
        allowNull: false,
        defaultValue: "draft",
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "published_at",
      },
      viewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "view_count",
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_deleted",
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "deleted_at",
      },
      deletedByAdminId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "deleted_by_admin_id",
      },
      createdByAdminId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "created_by_admin_id",
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
      modelName: "News",
      tableName: "news",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return News;
};
