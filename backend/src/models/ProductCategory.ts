import { DataTypes, Model, ModelStatic, Sequelize } from "sequelize";
import type { ProductAttributes } from './Product';
import type { CategoryAttributes } from './Category';

export interface ProductCategoryAttributes {
  id: string;
  productId: string;
  categoryId: string;
  createdAt: Date;
}

export interface ProductCategoryCreationAttributes
  extends Omit<ProductCategoryAttributes, "id" | "createdAt"> {
  id?: string;
}

export class ProductCategory
  extends Model<ProductCategoryAttributes, ProductCategoryCreationAttributes>
  implements ProductCategoryAttributes
{
  declare id: string;
  declare productId: string;
  declare categoryId: string;
  declare createdAt: Date;

  declare product?: ProductAttributes;
  declare category?: CategoryAttributes;

  static associate(models: Record<string, ModelStatic<Model>>) {
    ProductCategory.belongsTo(models.Product, {
      foreignKey: "productId",
      as: "product",
      onDelete: "CASCADE",
    });
    ProductCategory.belongsTo(models.Category, {
      foreignKey: "categoryId",
      as: "category",
      onDelete: "CASCADE",
    });
  }
}

export const ProductCategoryModel = (sequelize: Sequelize) => {
  ProductCategory.init(
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
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "category_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
    },
    {
      sequelize,
      modelName: "ProductCategory",
      tableName: "product_categories",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: ["product_id", "category_id"],
        },
      ],
    }
  );

  return ProductCategory;
};

