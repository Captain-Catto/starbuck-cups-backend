import { DataTypes, Model, Sequelize } from 'sequelize';

export interface HeroImageAttributes {
  id: string;
  title: string;
  imageUrl: string;
  altText: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface HeroImageCreationAttributes extends Omit<HeroImageAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class HeroImage extends Model<HeroImageAttributes, HeroImageCreationAttributes> implements HeroImageAttributes {
  declare id: string;
  declare title: string;
  declare imageUrl: string;
  declare altText: string;
  declare order: number;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations
  public createdByAdmin?: any;

  static associate(models: any) {
    HeroImage.belongsTo(models.AdminUser, {
      foreignKey: 'createdByAdminId',
      as: 'createdByAdmin',
    });
  }
}

export const HeroImageModel = (sequelize: Sequelize) => {
  HeroImage.init(
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
      imageUrl: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        field: 'image_url',
      },
      altText: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'alt_text',
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
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
      createdByAdminId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'created_by_admin_id',
      },
    },
    {
      sequelize,
      modelName: 'HeroImage',
      tableName: 'hero_images',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return HeroImage;
};