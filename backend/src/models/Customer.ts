import { DataTypes, Model, Sequelize } from 'sequelize';

export interface CustomerAttributes {
  id: string;
  messengerId?: string;
  zaloId?: string;
  fullName: string;
  phone: string;
  notes?: string;
  isVip: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByAdminId: string;
}

export interface CustomerCreationAttributes extends Omit<CustomerAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  declare id: string;
  public messengerId?: string;
  public zaloId?: string;
  declare fullName: string;
  declare phone: string;
  public notes?: string;
  declare isVip: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare createdByAdminId: string;

  // Associations
  public addresses?: any[];
  public createdByAdmin?: any;
  public orders?: any[];

  static associate(models: any) {
    Customer.hasMany(models.CustomerAddress, {
      foreignKey: 'customerId',
      as: 'addresses',
      onDelete: 'CASCADE',
    });
    Customer.belongsTo(models.AdminUser, {
      foreignKey: 'createdByAdminId',
      as: 'createdByAdmin',
    });
    Customer.hasMany(models.Order, {
      foreignKey: 'customerId',
      as: 'orders',
    });
  }
}

export const CustomerModel = (sequelize: Sequelize) => {
  Customer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      messengerId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'messenger_id',
      },
      zaloId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'zalo_id',
      },
      fullName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'full_name',
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isVip: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_vip',
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
      modelName: 'Customer',
      tableName: 'customers',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return Customer;
};