import { Sequelize } from "sequelize";
import sequelize from "../config/database";

// Import all models
import { AdminUser, AdminUserModel, AdminRole } from "./AdminUser";
import { Customer, CustomerModel } from "./Customer";
import { CustomerAddress, CustomerAddressModel } from "./CustomerAddress";
import { Color, ColorModel } from "./Color";
import { Capacity, CapacityModel } from "./Capacity";
import { Category, CategoryModel } from "./Category";
import { Product, ProductModel } from "./Product";
import { ProductCategory, ProductCategoryModel } from "./ProductCategory";
import { ProductColor, ProductColorModel } from "./ProductColor";
import { ProductImage, ProductImageModel } from "./ProductImage";
import { Order, OrderModel, OrderType, OrderStatus } from "./Order";
import { OrderItem, OrderItemModel } from "./OrderItem";
import { Consultation, ConsultationModel, ConsultationStatus } from "./Consultation";
import { ConsultationItem, ConsultationItemModel } from "./ConsultationItem";
import { HeroImage, HeroImageModel } from "./HeroImage";
import { ProductAnalytics, ProductAnalyticsModel } from "./ProductAnalytics";

// Initialize all models
const models = {
  AdminUser: AdminUserModel(sequelize),
  Customer: CustomerModel(sequelize),
  CustomerAddress: CustomerAddressModel(sequelize),
  Color: ColorModel(sequelize),
  Capacity: CapacityModel(sequelize),
  Category: CategoryModel(sequelize),
  Product: ProductModel(sequelize),
  ProductCategory: ProductCategoryModel(sequelize),
  ProductColor: ProductColorModel(sequelize),
  ProductImage: ProductImageModel(sequelize),
  Order: OrderModel(sequelize),
  OrderItem: OrderItemModel(sequelize),
  Consultation: ConsultationModel(sequelize),
  ConsultationItem: ConsultationItemModel(sequelize),
  HeroImage: HeroImageModel(sequelize),
  ProductAnalytics: ProductAnalyticsModel(sequelize),
};

// Define associations
Object.values(models).forEach((model: any) => {
  if (model.associate) {
    model.associate(models);
  }
});

export {
  sequelize,
  models,
  AdminUser,
  AdminRole,
  Customer,
  CustomerAddress,
  Color,
  Capacity,
  Category,
  Product,
  ProductCategory,
  ProductColor,
  ProductImage,
  Order,
  OrderType,
  OrderStatus,
  OrderItem,
  Consultation,
  ConsultationStatus,
  ConsultationItem,
  HeroImage,
  ProductAnalytics,
};

export default models;
