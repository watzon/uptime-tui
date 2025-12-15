-- Add new enum values to target_type
ALTER TYPE "public"."target_type" ADD VALUE IF NOT EXISTS 'dns';
ALTER TYPE "public"."target_type" ADD VALUE IF NOT EXISTS 'docker';
ALTER TYPE "public"."target_type" ADD VALUE IF NOT EXISTS 'postgres';
ALTER TYPE "public"."target_type" ADD VALUE IF NOT EXISTS 'redis';
