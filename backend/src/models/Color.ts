import { DataTypes, Model, Sequelize } from "sequelize";

export interface ColorAttributes {
  id: string;
  name: string;
  slug: string;
  hexCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface ColorCreationAttributes
  extends Omit<ColorAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class Color
  extends Model<ColorAttributes, ColorCreationAttributes>
  implements ColorAttributes
{
  declare id: string;
  declare name: string;
  declare slug: string;
  declare hexCode: string;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations - Use declare to avoid shadowing Sequelize getters/setters
  declare createdByAdmin?: any;
  declare productColors?: any[];

  static associate(models: any) {
    Color.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
    Color.hasMany(models.ProductColor, {
      foreignKey: "colorId",
      as: "productColors",
    });
  }
}

export const ColorModel = (sequelize: Sequelize) => {
  Color.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
      hexCode: {
        type: DataTypes.STRING(7),
        allowNull: false,
        field: "hex_code",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
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
      modelName: "Color",
      tableName: "colors",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Color;
};
