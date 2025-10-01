-- Drop the problematic unique constraint
ALTER TABLE customer_phones DROP INDEX unique_main_phone_per_customer;

-- Check if constraint is removed
SHOW INDEX FROM customer_phones;