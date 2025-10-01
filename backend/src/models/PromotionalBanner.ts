import { DataTypes, Model, Sequelize } from "sequelize";

export interface PromotionalBannerAttributes {
  id: string;
  title: string;
  highlightText: string | null;
  highlightColor: string | null;
  description: string;
  buttonText: string;
  buttonLink: string;
  isActive: boolean;
  priority: number;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface PromotionalBannerCreationAttributes
  extends Omit<PromotionalBannerAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class PromotionalBanner
  extends Model<
    PromotionalBannerAttributes,
    PromotionalBannerCreationAttributes
  >
  implements PromotionalBannerAttributes
{
  declare id: string;
  declare title: string;
  declare highlightText: string | null;
  declare highlightColor: string | null;
  declare description: string;
  declare buttonText: string;
  declare buttonLink: string;
  declare isActive: boolean;
  declare priority: number;
  declare validFrom: Date | null;
  declare validUntil: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations
  public createdByAdmin?: any;

  static associate(models: any) {
    PromotionalBanner.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
  }
}

export const PromotionalBannerModel = (sequelize: Sequelize) => {
  PromotionalBanner.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      highlightText: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "highlight_text",
      },
      highlightColor: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: "highlight_color",
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      buttonText: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "button_text",
      },
      buttonLink: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: "button_link",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      validFrom: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "valid_from",
      },
      validUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "valid_until",
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
      createdByAdminId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "created_by_admin_id",
      },
    },
    {
      sequelize,
      modelName: "PromotionalBanner",
      tableName: "promotional_banners",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return PromotionalBanner;
};
