import { DataTypes, Model, Sequelize } from 'sequelize';

export interface CustomerAddressAttributes {
  id: string;
  customerId: string;
  addressLine: string;
  ward?: string;
  district?: string;
  city: string;
  postalCode?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddressCreationAttributes extends Omit<CustomerAddressAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class CustomerAddress extends Model<CustomerAddressAttributes, CustomerAddressCreationAttributes> implements CustomerAddressAttributes {
  declare id: string;
  declare customerId: string;
  declare addressLine: string;
  public ward?: string;
  public district?: string;
  declare city: string;
  public postalCode?: string;
  declare isDefault: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  public customer?: any;

  static associate(models: any) {
    CustomerAddress.belongsTo(models.Customer, {
      foreignKey: 'customerId',
      as: 'customer',
      onDelete: 'CASCADE',
    });
  }
}

export const CustomerAddressModel = (sequelize: Sequelize) => {
  CustomerAddress.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
      },
      addressLine: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'address_line',
      },
      ward: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      district: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'postal_code',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
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
      modelName: 'CustomerAddress',
      tableName: 'customer_addresses',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return CustomerAddress;
};