import { DataTypes, Model, Sequelize } from 'sequelize';

export interface ProductImageAttributes {
  id: string;
  productId: string;
  url: string;
  altText?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImageCreationAttributes extends Omit<ProductImageAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class ProductImage extends Model<ProductImageAttributes, ProductImageCreationAttributes> implements ProductImageAttributes {
  declare id: string;
  declare productId: string;
  declare url: string;
  public altText?: string;
  declare order: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  public product?: any;

  static associate(models: any) {
    ProductImage.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product',
      onDelete: 'CASCADE',
    });
  }
}

export const ProductImageModel = (sequelize: Sequelize) => {
  ProductImage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      url: {
        type: DataTypes.STRING(1000),
        allowNull: false,
      },
      altText: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'alt_text',
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      modelName: 'ProductImage',
      tableName: 'product_images',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        {
          unique: true,
          fields: ['product_id', 'order'],
        },
      ],
    }
  );

  return ProductImage;
};