import { DataTypes, Model, Sequelize } from 'sequelize';

export interface OrderItemAttributes {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  productSnapshot: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemCreationAttributes extends Omit<OrderItemAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class OrderItem extends Model<OrderItemAttributes, OrderItemCreationAttributes> implements OrderItemAttributes {
  declare id: string;
  declare orderId: string;
  declare productId: string;
  declare quantity: number;
  declare productSnapshot: any;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  declare order?: any;
  declare product?: any;

  static associate(models: any) {
    OrderItem.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order',
      onDelete: 'CASCADE',
    });
    OrderItem.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product',
    });
  }
}

export const OrderItemModel = (sequelize: Sequelize) => {
  OrderItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'order_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      productSnapshot: {
        type: DataTypes.JSON,
        allowNull: false,
        field: 'product_snapshot',
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
      modelName: 'OrderItem',
      tableName: 'order_items',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        {
          name: "idx_order_items_order_id",
          fields: ["order_id"],
        },
        {
          name: "idx_order_items_product_id",
          fields: ["product_id"],
        },
        {
          name: "idx_order_items_order_product",
          fields: ["order_id", "product_id"],
        },
      ],
    }
  );

  return OrderItem;
};
