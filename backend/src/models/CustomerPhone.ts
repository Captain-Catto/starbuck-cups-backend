import { DataTypes, Model, ModelStatic, Sequelize } from "sequelize";
import type { CustomerAttributes } from './Customer';

export interface CustomerPhoneAttributes {
  id: string;
  customerId: string;
  phoneNumber: string;
  isMain: boolean;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPhoneCreationAttributes
  extends Omit<CustomerPhoneAttributes, "id" | "createdAt" | "updatedAt"> {
  id?: string;
}

export class CustomerPhone
  extends Model<CustomerPhoneAttributes, CustomerPhoneCreationAttributes>
  implements CustomerPhoneAttributes
{
  declare id: string;
  declare customerId: string;
  declare phoneNumber: string;
  declare isMain: boolean;
  declare label?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  declare customer?: CustomerAttributes;

  static associate(models: Record<string, ModelStatic<Model>>) {
    CustomerPhone.belongsTo(models.Customer, {
      foreignKey: "customerId",
      as: "customer",
    });
  }
}

export const CustomerPhoneModel = (sequelize: Sequelize) => {
  CustomerPhone.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "customer_id",
        references: {
          model: "customers",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "phone_number",
      },
      isMain: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_main",
      },
      label: {
        type: DataTypes.STRING(50),
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
      modelName: "CustomerPhone",
      tableName: "customer_phones",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      indexes: [
        {
          fields: ["customer_id"],
        },
        {
          fields: ["phone_number"],
        },
        // Note: We handle "only one main phone per customer" logic in application code
        // instead of database constraint to avoid issues with updates
        {
          fields: ["customer_id", "is_main"],
        },
      ],
    }
  );

  return CustomerPhone;
};

