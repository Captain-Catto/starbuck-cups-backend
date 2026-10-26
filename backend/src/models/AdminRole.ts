import { DataTypes, Model, ModelStatic, Sequelize } from "sequelize";

export interface AdminRoleAttributes {
  id: string;
  /** Set for the built-in roles (SUPER_ADMIN, ADMIN, STAFF); null for roles created by an admin. */
  key: string | null;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRoleCreationAttributes
  extends Omit<AdminRoleAttributes, "id" | "createdAt" | "updatedAt" | "description" | "key"> {
  id?: string;
  key?: string | null;
  description?: string | null;
}

export class AdminRole
  extends Model<AdminRoleAttributes, AdminRoleCreationAttributes>
  implements AdminRoleAttributes
{
  declare id: string;
  declare key: string | null;
  declare name: string;
  declare description?: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;

  declare permissions?: AdminRolePermission[];

  get isSystem(): boolean {
    return this.key !== null;
  }

  static associate(models: Record<string, unknown>) {
    AdminRole.hasMany(models.AdminRolePermission as typeof AdminRolePermission, {
      foreignKey: "roleId",
      as: "permissions",
      onDelete: "CASCADE",
    });
    AdminRole.hasMany(models.AdminUser as ModelStatic<Model>, { foreignKey: "roleId", as: "users" });
  }
}

export interface AdminRolePermissionAttributes {
  roleId: string;
  permission: string;
}

export class AdminRolePermission
  extends Model<AdminRolePermissionAttributes, AdminRolePermissionAttributes>
  implements AdminRolePermissionAttributes
{
  declare roleId: string;
  declare permission: string;
}

export const AdminRoleModel = (sequelize: Sequelize) => {
  AdminRole.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(30), allowNull: true, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize, tableName: "admin_roles", timestamps: true }
  );
  return AdminRole;
};

export const AdminRolePermissionModel = (sequelize: Sequelize) => {
  AdminRolePermission.init(
    {
      roleId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "role_id" },
      permission: { type: DataTypes.STRING(60), allowNull: false, primaryKey: true },
    },
    { sequelize, tableName: "admin_role_permissions", timestamps: false }
  );
  return AdminRolePermission;
};
