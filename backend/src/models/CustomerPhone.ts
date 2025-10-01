import { DataTypes, Model, Sequelize } from "sequelize";

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
  public label?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  public customer?: any;

  static associate(models: any) {
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
