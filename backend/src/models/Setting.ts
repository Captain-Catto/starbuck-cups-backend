import { DataTypes, Model, Sequelize } from "sequelize";

export interface SettingAttributes {
  id: string;
  key: string;
  value: any;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingCreationAttributes
  extends Omit<SettingAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class Setting
  extends Model<SettingAttributes, SettingCreationAttributes>
  implements SettingAttributes
{
  declare id: string;
  declare key: string;
  declare value: any;
  declare description?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static associate(models: any) {
    // No associations needed for now
  }
}

export const SettingModel = (sequelize: Sequelize) => {
  Setting.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      value: {
        type: DataTypes.JSON, // Use JSON for flexible settings storage
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      modelName: "Setting",
      tableName: "settings",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Setting;
};
