import { DataTypes, Model, Sequelize } from "sequelize";

export type ProductLocale = "vi" | "en" | "zh";

export interface ProductTranslationAttributes {
  id: string;
  productId: string;
  locale: ProductLocale;
  name: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTranslationCreationAttributes
  extends Omit<ProductTranslationAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class ProductTranslation
  extends Model<
    ProductTranslationAttributes,
    ProductTranslationCreationAttributes
  >
  implements ProductTranslationAttributes
{
  declare id: string;
  declare productId: string;
  declare locale: ProductLocale;
  declare name: string;
  declare description?: string;
  declare metaTitle?: string;
  declare metaDescription?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  declare product?: any;

  static associate(models: any) {
    ProductTranslation.belongsTo(models.Product, {
      foreignKey: "productId",
      as: "product",
      onDelete: "CASCADE",
    });
  }
}

export const ProductTranslationModel = (sequelize: Sequelize) => {
  ProductTranslation.init(
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
      locale: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
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
      modelName: "ProductTranslation",
      tableName: "product_translations",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          unique: true,
          fields: ["product_id", "locale"],
          name: "uq_product_translations_product_locale",
        },
      ],
    }
  );

  return ProductTranslation;
};
