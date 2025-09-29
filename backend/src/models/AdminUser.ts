import { DataTypes, Model, Sequelize } from 'sequelize';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export interface AdminUserAttributes {
  id: string;
  username: string;
  passwordHash: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
  refreshTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserCreationAttributes extends Omit<AdminUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class AdminUser extends Model<AdminUserAttributes, AdminUserCreationAttributes> implements AdminUserAttributes {
  declare id: string;
  declare username: string;
  declare passwordHash: string;
  declare email: string;
  declare role: AdminRole;
  declare isActive: boolean;
  declare lastLoginAt?: Date;
  declare refreshTokenHash?: string;
  declare refreshTokenExpiresAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  declare createdCapacities?: any[];
  declare createdCategories?: any[];
  declare createdColors?: any[];
  declare createdCustomers?: any[];
  declare deletedProducts?: any[];
  declare createdHeroImages?: any[];

  static associate(models: any) {
    AdminUser.hasMany(models.Capacity, {
      foreignKey: 'createdByAdminId',
      as: 'createdCapacities',
    });
    AdminUser.hasMany(models.Category, {
      foreignKey: 'createdByAdminId',
      as: 'createdCategories',
    });
    AdminUser.hasMany(models.Color, {
      foreignKey: 'createdByAdminId',
      as: 'createdColors',
    });
    AdminUser.hasMany(models.Customer, {
      foreignKey: 'createdByAdminId',
      as: 'createdCustomers',
    });
    AdminUser.hasMany(models.Product, {
      foreignKey: 'deletedByAdminId',
      as: 'deletedProducts',
    });
    AdminUser.hasMany(models.HeroImage, {
      foreignKey: 'createdByAdminId',
      as: 'createdHeroImages',
    });
  }
}

export const AdminUserModel = (sequelize: Sequelize) => {
  AdminUser.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      role: {
        type: DataTypes.ENUM(...Object.values(AdminRole)),
        allowNull: false,
        defaultValue: AdminRole.STAFF,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at',
      },
      refreshTokenHash: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'refresh_token_hash',
      },
      refreshTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'refresh_token_expires_at',
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
      modelName: 'AdminUser',
      tableName: 'admin_users',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return AdminUser;
};