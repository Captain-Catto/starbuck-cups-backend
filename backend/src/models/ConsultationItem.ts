import { DataTypes, Model, Sequelize } from 'sequelize';

export interface ConsultationItemAttributes {
  id: string;
  consultationId: string;
  productId: string;
  productName: string;
  color: string;
  capacity: string;
  category: string;
  createdAt: Date;
}

export interface ConsultationItemCreationAttributes extends Omit<ConsultationItemAttributes, 'id' | 'createdAt'> {
  id?: string;
}

export class ConsultationItem extends Model<ConsultationItemAttributes, ConsultationItemCreationAttributes> implements ConsultationItemAttributes {
  declare id: string;
  declare consultationId: string;
  declare productId: string;
  declare productName: string;
  declare color: string;
  declare capacity: string;
  declare category: string;
  declare createdAt: Date;

  // Associations
  public consultation?: any;
  public product?: any;

  static associate(models: any) {
    ConsultationItem.belongsTo(models.Consultation, {
      foreignKey: 'consultationId',
      as: 'consultation',
      onDelete: 'CASCADE',
    });
    ConsultationItem.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product',
    });
  }
}

export const ConsultationItemModel = (sequelize: Sequelize) => {
  ConsultationItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      consultationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'consultation_id',
      },
      productId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'product_id',
      },
      productName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'product_name',
      },
      color: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      capacity: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'ConsultationItem',
      tableName: 'consultation_items',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: false,
    }
  );

  return ConsultationItem;
};