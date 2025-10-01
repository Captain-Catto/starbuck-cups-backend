import { CustomerPhone } from "../models/CustomerPhone";
import { Customer } from "../models/Customer";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { validateAndFormatPhone } from "../utils/phoneValidation";

export interface CustomerPhoneCreateData {
  customerId: string;
  phoneNumber: string;
  isMain?: boolean;
  label?: string;
}

export interface CustomerPhoneUpdateData {
  phoneNumber?: string;
  isMain?: boolean;
  label?: string;
}

export class CustomerPhoneService {
  constructor() {}

  async getCustomerPhones(customerId: string) {
    try {
      const phones = await CustomerPhone.findAll({
        where: { customerId },
        order: [
          ["isMain", "DESC"],
          ["createdAt", "ASC"],
        ],
      });

      return phones;
    } catch (error) {
      console.error("Database error fetching customer phones:", error);
      throw new Error("Failed to fetch customer phones from database");
    }
  }

  async createCustomerPhone(data: CustomerPhoneCreateData) {
    try {
      // Validate phone number
      const phoneValidation = validateAndFormatPhone(data.phoneNumber);
      if (!phoneValidation.isValid) {
        throw new Error(phoneValidation.error || "Invalid phone number");
      }

      // Check if customer exists
      const customer = await Customer.findByPk(data.customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Check if phone number already exists for this customer
      const existingPhone = await CustomerPhone.findOne({
        where: {
          customerId: data.customerId,
          phoneNumber: phoneValidation.formatted,
        },
      });

      if (existingPhone) {
        throw new Error("Phone number already exists for this customer");
      }

      // If this is set as main phone, we need to unset other main phones
      if (data.isMain) {
        await CustomerPhone.update(
          { isMain: false },
          {
            where: {
              customerId: data.customerId,
              isMain: true,
            },
          }
        );
      } else {
        // If no main phone exists yet, make this the main phone
        const mainPhoneExists = await CustomerPhone.findOne({
          where: {
            customerId: data.customerId,
            isMain: true,
          },
        });

        if (!mainPhoneExists) {
          data.isMain = true;
        }
      }

      const phone = await CustomerPhone.create({
        customerId: data.customerId,
        phoneNumber: phoneValidation.formatted,
        isMain: data.isMain || false,
        label: data.label,
      });

      return phone;
    } catch (error) {
      console.error("Database error creating customer phone:", error);
      throw error;
    }
  }

  async updateCustomerPhone(phoneId: string, data: CustomerPhoneUpdateData) {
    const transaction = await sequelize.transaction();

    try {
      const phone = await CustomerPhone.findByPk(phoneId, { transaction });
      if (!phone) {
        throw new Error("Phone not found");
      }

      // Validate phone number if provided
      if (data.phoneNumber) {
        const phoneValidation = validateAndFormatPhone(data.phoneNumber);
        if (!phoneValidation.isValid) {
          throw new Error(phoneValidation.error || "Invalid phone number");
        }

        // Check if phone number already exists for this customer (excluding current phone)
        const existingPhone = await CustomerPhone.findOne({
          where: {
            customerId: phone.customerId,
            phoneNumber: phoneValidation.formatted,
            id: { [Op.ne]: phoneId },
          },
          transaction,
        });

        if (existingPhone) {
          throw new Error("Phone number already exists for this customer");
        }

        data.phoneNumber = phoneValidation.formatted;
      }

      // If setting as main phone, first update this phone, then unset others
      if (data.isMain === true) {
        // First update this phone to be main
        await phone.update(data, { transaction });

        // Then find and unset other main phones for this customer
        const otherMainPhones = await CustomerPhone.findAll({
          where: {
            customerId: phone.customerId,
            isMain: true,
            id: { [Op.ne]: phoneId },
          },
          transaction,
        });

        // Update each other phone individually to avoid constraint conflicts
        for (const otherPhone of otherMainPhones) {
          await otherPhone.update({ isMain: false }, { transaction });
        }
      } else {
        // Don't allow unsetting main phone if it's the only phone
        if (data.isMain === false && phone.isMain) {
          const phoneCount = await CustomerPhone.count({
            where: { customerId: phone.customerId },
            transaction,
          });

          if (phoneCount === 1) {
            throw new Error(
              "Cannot unset main phone when it's the only phone number"
            );
          }

          // If unsetting main phone, set another phone as main
          const anotherPhone = await CustomerPhone.findOne({
            where: {
              customerId: phone.customerId,
              id: { [Op.ne]: phoneId },
            },
            order: [["createdAt", "ASC"]],
            transaction,
          });

          if (anotherPhone) {
            await anotherPhone.update({ isMain: true }, { transaction });
          }
        }

        await phone.update(data, { transaction });
      }

      await transaction.commit();
      return phone;
    } catch (error) {
      await transaction.rollback();
      console.error("Database error updating customer phone:", error);
      throw error;
    }
  }

  async deleteCustomerPhone(phoneId: string) {
    try {
      const phone = await CustomerPhone.findByPk(phoneId);
      if (!phone) {
        throw new Error("Phone not found");
      }

      // Check if this is the only phone for the customer
      const phoneCount = await CustomerPhone.count({
        where: { customerId: phone.customerId },
      });

      if (phoneCount === 1) {
        throw new Error("Cannot delete the only phone number for a customer");
      }

      // If deleting main phone, set another phone as main
      if (phone.isMain) {
        const anotherPhone = await CustomerPhone.findOne({
          where: {
            customerId: phone.customerId,
            id: { [Op.ne]: phoneId },
          },
          order: [["createdAt", "ASC"]],
        });

        if (anotherPhone) {
          await anotherPhone.update({ isMain: true });
        }
      }

      await phone.destroy();
      return { success: true };
    } catch (error) {
      console.error("Database error deleting customer phone:", error);
      throw error;
    }
  }

  async setMainPhone(phoneId: string) {
    const transaction = await sequelize.transaction();

    try {
      const phone = await CustomerPhone.findByPk(phoneId, { transaction });
      if (!phone) {
        throw new Error("Phone not found");
      }

      // First, unset ALL main phones for this customer
      await CustomerPhone.update(
        { isMain: false },
        {
          where: {
            customerId: phone.customerId,
            isMain: true,
          },
          transaction,
        }
      );

      // Then, set the target phone as main
      await phone.update({ isMain: true }, { transaction });

      await transaction.commit();
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      console.error("Database error setting main phone:", error);
      throw error;
    }
  }

  async getCustomerMainPhone(customerId: string): Promise<string | null> {
    try {
      const mainPhone = await CustomerPhone.findOne({
        where: {
          customerId,
          isMain: true,
        },
      });

      return mainPhone ? mainPhone.phoneNumber : null;
    } catch (error) {
      console.error("Database error getting customer main phone:", error);
      return null;
    }
  }
}
