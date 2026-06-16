import { DataTypes, Model, ModelStatic, Sequelize } from "sequelize";
import type { ProductAttributes } from './Product';
import type { ColorAttributes } from './Color';

export interface ProductColorAttributes {
  id: string;
  productId: string;
  colorId: string;
  createdAt: Date;
}

export interface ProductColorCreationAttributes
  extends Omit<ProductColorAttributes, "id" | "createdAt"> {
  id?: string;
}

export class ProductColor
  extends Model<ProductColorAttributes, ProductColorCreationAttributes>
  implements ProductColorAttributes
{
  declare id: string;
  declare productId: string;
  declare colorId: string;
  declare createdAt: Date;

  declare product?: ProductAttributes;
  declare color?: ColorAttributes;

  static associate(models: Record<string, ModelStatic<Model>>) {
    ProductColor.belongsTo(models.Product, {
      foreignKey: "productId",
      as: "product",
      onDelete: "CASCADE",
    });
    ProductColor.belongsTo(models.Color, {
      foreignKey: "colorId",
      as: "color",
      onDelete: "CASCADE",
    });
  }
}

export const ProductColorModel = (sequelize: Sequelize) => {
  ProductColor.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "product_id",
      },
      colorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "color_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
    },
    {
      sequelize,
      modelName: "ProductColor",
      tableName: "product_colors",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: ["product_id", "color_id"],
        },
      ],
    }
  );

  return ProductColor;
};

