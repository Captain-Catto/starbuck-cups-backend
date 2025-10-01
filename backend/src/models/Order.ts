import { DataTypes, Model, Sequelize } from 'sequelize';

export enum OrderType {
  CUSTOM = 'CUSTOM',
  PRODUCT = 'PRODUCT',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface OrderAttributes {
  id: string;
  orderNumber: string;
  customerId: string;
  orderType: OrderType;
  status: OrderStatus;
  totalAmount: number;
  shippingCost: number;
  customDescription?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  deliveryAddress?: any;
  originalShippingCost: number;
  shippingDiscount: number;
  customerMainPhone?: string;
}

export interface OrderCreationAttributes extends Omit<OrderAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class Order extends Model<OrderAttributes, OrderCreationAttributes> implements OrderAttributes {
  declare id: string;
  declare orderNumber: string;
  declare customerId: string;
  declare orderType: OrderType;
  declare status: OrderStatus;
  declare totalAmount: number;
  declare shippingCost: number;
  public customDescription?: string;
  public notes?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  public confirmedAt?: Date;
  public completedAt?: Date;
  public deliveryAddress?: any;
  declare originalShippingCost: number;
  declare shippingDiscount: number;
  public customerMainPhone?: string;

  // Associations
  public items?: any[];
  public customer?: any;

  static associate(models: any) {
    Order.hasMany(models.OrderItem, {
      foreignKey: 'orderId',
      as: 'items',
      onDelete: 'CASCADE',
    });
    Order.belongsTo(models.Customer, {
      foreignKey: 'customerId',
      as: 'customer',
    });
  }
}

export const OrderModel = (sequelize: Sequelize) => {
  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        field: 'order_number',
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'customer_id',
      },
      orderType: {
        type: DataTypes.ENUM(...Object.values(OrderType)),
        allowNull: false,
        field: 'order_type',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(OrderStatus)),
        allowNull: false,
        defaultValue: OrderStatus.PENDING,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'total_amount',
      },
      shippingCost: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'shipping_cost',
      },
      customDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'custom_description',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
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
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'confirmed_at',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
      },
      deliveryAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'delivery_address',
      },
      originalShippingCost: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'original_shipping_cost',
      },
      shippingDiscount: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'shipping_discount',
      },
      customerMainPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'customer_main_phone',
      },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return Order;
};