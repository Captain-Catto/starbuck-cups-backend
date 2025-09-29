import { DataTypes, Model, Sequelize } from "sequelize";

export interface CategoryAttributes {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface CategoryCreationAttributes
  extends Omit<CategoryAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  declare id: string;
  declare name: string;
  declare slug: string;
  declare description?: string;
  declare parentId?: string;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations - Use declare to avoid shadowing Sequelize getters/setters
  declare createdByAdmin?: any;
  declare parent?: any;
  declare children?: any[];
  declare productCategories?: any[];

  static associate(models: any) {
    Category.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
    Category.belongsTo(models.Category, {
      foreignKey: "parentId",
      as: "parent",
    });
    Category.hasMany(models.Category, {
      foreignKey: "parentId",
      as: "children",
    });
    Category.hasMany(models.ProductCategory, {
      foreignKey: "categoryId",
      as: "productCategories",
    });
  }
}

export const CategoryModel = (sequelize: Sequelize) => {
  Category.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(300),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "parent_id",
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
      modelName: "Category",
      tableName: "categories",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Category;
};
