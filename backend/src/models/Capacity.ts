import { DataTypes, Model, Sequelize } from "sequelize";

export interface CapacityAttributes {
  id: string;
  name: string;
  slug: string;
  volumeMl: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface CapacityCreationAttributes
  extends Omit<CapacityAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class Capacity
  extends Model<CapacityAttributes, CapacityCreationAttributes>
  implements CapacityAttributes
{
  declare id: string;
  declare name: string;
  declare slug: string;
  declare volumeMl: number;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations - Use declare to avoid shadowing Sequelize getters/setters
  declare createdByAdmin?: any;
  declare products?: any[];

  static associate(models: any) {
    Capacity.belongsTo(models.AdminUser, {
      foreignKey: "createdByAdminId",
      as: "createdByAdmin",
    });
    Capacity.hasMany(models.Product, {
      foreignKey: "capacityId",
      as: "products",
    });
  }
}

export const CapacityModel = (sequelize: Sequelize) => {
  Capacity.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
      volumeMl: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "volume_ml",
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
      modelName: "Capacity",
      tableName: "capacities",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );

  return Capacity;
};
