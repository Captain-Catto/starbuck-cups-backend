import { DataTypes, Model, Sequelize } from 'sequelize';

export enum ConsultationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface ConsultationAttributes {
  id: string;
  customerName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  status: ConsultationStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsultationCreationAttributes extends Omit<ConsultationAttributes, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

export class Consultation extends Model<ConsultationAttributes, ConsultationCreationAttributes> implements ConsultationAttributes {
  declare id: string;
  declare customerName: string;
  declare phoneNumber: string;
  declare email?: string;
  declare address: string;
  declare status: ConsultationStatus;
  public notes?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  public consultationItems?: any[];

  static associate(models: any) {
    Consultation.hasMany(models.ConsultationItem, {
      foreignKey: 'consultationId',
      as: 'consultationItems',
      onDelete: 'CASCADE',
    });
  }
}

export const ConsultationModel = (sequelize: Sequelize) => {
  Consultation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      customerName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'customer_name',
      },
      phoneNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'phone_number',
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(ConsultationStatus)),
        allowNull: false,
        defaultValue: ConsultationStatus.PENDING,
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
    },
    {
      sequelize,
      modelName: 'Consultation',
      tableName: 'consultations',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return Consultation;
};