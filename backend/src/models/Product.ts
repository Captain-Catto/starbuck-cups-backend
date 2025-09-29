import { DataTypes, Model, Sequelize } from "sequelize";

export interface ProductAttributes {
  id: string;
  slug: string;
  name: string;
  description?: string;
  capacityId: string;
  stockQuantity: number;
  productUrl?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedByAdminId?: string;
  createdAt: Date;
  updatedAt: Date;
  unitPrice: number;
  createdByAdminId: string;
}

export interface ProductCreationAttributes
  extends Omit<ProductAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  declare id: string;
  declare slug: string;
  declare name: string;
  declare description?: string;
  declare capacityId: string;
  declare stockQuantity: number;
  declare productUrl?: string;
  declare isActive: boolean;
  declare isDeleted: boolean;
  declare deletedAt?: Date;
  declare deletedByAdminId?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare unitPrice: number;
  declare createdByAdminId: string;

  // Associations - Use declare to avoid shadowing Sequelize getters/setters
  declare consultationItems?: any[];
  declare orderItems?: any[];
  declare productImages?: any[];
  declare productCategories?: any[];
  declare productColors?: any[];
  declare capacity?: any;
  declare deletedByAdmin?: any;
  declare createdByAdmin?: any;

  static associate(models: any) {
    Product.hasMany(models.ConsultationItem, {
      foreignKey: "productId",
      as: "consultationItems",
      onDelete: "CASCADE",
    });
    Product.hasMany(models.OrderItem, {
      foreignKey: "productId",
      as: "orderItems",
      onDelete: "CASCADE",
    });
    Product.hasMany(models.ProductImage, {
      foreignKey: "productId",
      as: "productImages",
      onDelete: "CASCADE",
    });
    Product.hasMany(models.ProductCategory, {
      foreignKey: "productId",
      as: "productCategories",
      onDelete: "CASCADE",
    });
    Product.hasMany(models.ProductColor, {
      foreignKey: "productId",
      as: "productColors",
      onDelete: "CASCADE",
    });
    Product.belongsTo(models.Capacity, {
      foreignKey: "capacityId",
      as: "capacity",
    });
    Product.belongsTo(models.AdminUser, {
      foreignKey: "deletedByAdminId",
      as: "deletedByAdmin",
    });
    Product.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
  }
}

export const ProductModel = (sequelize: Sequelize) => {
  Product.init(
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
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      capacityId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "capacity_id",
      },
      stockQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "stock_quantity",
      },
      productUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "product_url",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
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
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: "unit_price",
      },
      createdByAdminId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "created_by_admin_id",
      },
    },
    {
      sequelize,
      modelName: "Product",
      tableName: "products",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Product;
};
