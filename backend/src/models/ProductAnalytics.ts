import { DataTypes, Model, Sequelize } from "sequelize";

export interface ProductAnalyticsAttributes {
  id: string;
  productId: string;
  clickCount: number;
  addToCartCount: number;
  lastClicked?: Date;
  lastAddedToCart?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductAnalyticsCreationAttributes
  extends Omit<ProductAnalyticsAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class ProductAnalytics
  extends Model<ProductAnalyticsAttributes, ProductAnalyticsCreationAttributes>
  implements ProductAnalyticsAttributes
{
  declare id: string;
  declare productId: string;
  declare clickCount: number;
  declare addToCartCount: number;
  declare lastClicked?: Date;
  declare lastAddedToCart?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function ProductAnalyticsModel(sequelize: Sequelize) {
  ProductAnalytics.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: "id",
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true, // One record per product
        field: "product_id",
        references: {
          model: "products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      clickCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "click_count",
      },
      addToCartCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "add_to_cart_count",
      },
      lastClicked: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_clicked",
      },
      lastAddedToCart: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_added_to_cart",
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
      tableName: "product_analytics",
      modelName: "ProductAnalytics",
      timestamps: true,
      underscored: true,
    }
  );

  return ProductAnalytics;
}

// Define associations
(ProductAnalytics as any).associate = (models: any) => {
  // Each analytics record belongs to one product
  ProductAnalytics.belongsTo(models.Product, {
    foreignKey: "productId",
    as: "product",
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
};