import { DataTypes, Model, Sequelize } from "sequelize";

export interface AdminRefreshTokenAttributes {
  id: string;
  adminUserId: string;
  tokenHash: string;
  expiresAt: Date;
  /** Set when the token was rotated; it stays usable for a short grace window. */
  replacedAt?: Date | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRefreshTokenCreationAttributes
  extends Omit<AdminRefreshTokenAttributes, "id" | "createdAt" | "updatedAt" | "replacedAt"> {
  id?: string;
  replacedAt?: Date | null;
}

export class AdminRefreshToken
  extends Model<AdminRefreshTokenAttributes, AdminRefreshTokenCreationAttributes>
  implements AdminRefreshTokenAttributes
{
  declare id: string;
  declare adminUserId: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare replacedAt?: Date | null;
  declare userAgent?: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export const AdminRefreshTokenModel = (sequelize: Sequelize) => {
  AdminRefreshToken.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      adminUserId: { type: DataTypes.CHAR(36), allowNull: false, field: "admin_user_id" },
      tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true, field: "token_hash" },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
      replacedAt: { type: DataTypes.DATE, allowNull: true, field: "replaced_at" },
      userAgent: { type: DataTypes.STRING(255), allowNull: true, field: "user_agent" },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    { sequelize, tableName: "admin_refresh_tokens", timestamps: true }
  );
  return AdminRefreshToken;
};
