# ACTUAL DATABASE CONSTRAINTS & INDEXES FORENSIC REPORT

Generated from Neon PostgreSQL live metadata.

## 1. Table Constraints (information_schema.table_constraints)

| Table | Constraint Name | Type | Column |
|---|---|---|---|
| Conversation | Conversation_businessId_fkey | FOREIGN KEY | businessId |
| Conversation | Conversation_customerId_fkey | FOREIGN KEY | customerId |
| Conversation | Conversation_pkey | PRIMARY KEY | id |
| Customer | Customer_businessId_fkey | FOREIGN KEY | businessId |
| Customer | Customer_pkey | PRIMARY KEY | id |
| CustomerIdentityLink | CustomerIdentityLink_businessId_fkey | FOREIGN KEY | businessId |
| CustomerIdentityLink | CustomerIdentityLink_customerId_fkey | FOREIGN KEY | customerId |
| CustomerIdentityLink | CustomerIdentityLink_pkey | PRIMARY KEY | id |
| Message | Message_conversationId_fkey | FOREIGN KEY | conversationId |
| Message | Message_customerId_fkey | FOREIGN KEY | customerId |
| Message | Message_pkey | PRIMARY KEY | id |
| PlatformConnection | PlatformConnection_businessId_fkey | FOREIGN KEY | businessId |
| PlatformConnection | PlatformConnection_pkey | PRIMARY KEY | id |

## 2. PostgreSQL Active Indexes (pg_indexes)

| Table | Index Name | Index Definition |
|---|---|---|
| Conversation | Conversation_businessId_environment_idx | `CREATE INDEX "Conversation_businessId_environment_idx" ON public."Conversation" USING btree ("businessId", environment)` |
| Conversation | Conversation_businessId_environment_platform_idx | `CREATE INDEX "Conversation_businessId_environment_platform_idx" ON public."Conversation" USING btree ("businessId", environment, platform)` |
| Conversation | Conversation_businessId_platform_idx | `CREATE INDEX "Conversation_businessId_platform_idx" ON public."Conversation" USING btree ("businessId", platform)` |
| Conversation | Conversation_businessId_status_idx | `CREATE INDEX "Conversation_businessId_status_idx" ON public."Conversation" USING btree ("businessId", status)` |
| Conversation | Conversation_customerId_idx | `CREATE INDEX "Conversation_customerId_idx" ON public."Conversation" USING btree ("customerId")` |
| Conversation | Conversation_pkey | `CREATE UNIQUE INDEX "Conversation_pkey" ON public."Conversation" USING btree (id)` |
| Customer | Customer_businessId_environment_idx | `CREATE INDEX "Customer_businessId_environment_idx" ON public."Customer" USING btree ("businessId", environment)` |
| Customer | Customer_businessId_externalId_idx | `CREATE INDEX "Customer_businessId_externalId_idx" ON public."Customer" USING btree ("businessId", "externalId")` |
| Customer | Customer_businessId_leadStatus_idx | `CREATE INDEX "Customer_businessId_leadStatus_idx" ON public."Customer" USING btree ("businessId", "leadStatus")` |
| Customer | Customer_businessId_primaryPlatform_idx | `CREATE INDEX "Customer_businessId_primaryPlatform_idx" ON public."Customer" USING btree ("businessId", "primaryPlatform")` |
| Customer | Customer_pkey | `CREATE UNIQUE INDEX "Customer_pkey" ON public."Customer" USING btree (id)` |
| CustomerIdentityLink | CustomerIdentityLink_businessId_platform_externalId_key | `CREATE UNIQUE INDEX "CustomerIdentityLink_businessId_platform_externalId_key" ON public."CustomerIdentityLink" USING btree ("businessId", platform, "externalId")` |
| CustomerIdentityLink | CustomerIdentityLink_businessId_platform_idx | `CREATE INDEX "CustomerIdentityLink_businessId_platform_idx" ON public."CustomerIdentityLink" USING btree ("businessId", platform)` |
| CustomerIdentityLink | CustomerIdentityLink_customerId_idx | `CREATE INDEX "CustomerIdentityLink_customerId_idx" ON public."CustomerIdentityLink" USING btree ("customerId")` |
| CustomerIdentityLink | CustomerIdentityLink_pkey | `CREATE UNIQUE INDEX "CustomerIdentityLink_pkey" ON public."CustomerIdentityLink" USING btree (id)` |
| Message | Message_conversationId_environment_idx | `CREATE INDEX "Message_conversationId_environment_idx" ON public."Message" USING btree ("conversationId", environment)` |
| Message | Message_conversationId_sentAt_idx | `CREATE INDEX "Message_conversationId_sentAt_idx" ON public."Message" USING btree ("conversationId", "sentAt")` |
| Message | Message_externalMessageId_key | `CREATE UNIQUE INDEX "Message_externalMessageId_key" ON public."Message" USING btree ("externalMessageId")` |
| Message | Message_pkey | `CREATE UNIQUE INDEX "Message_pkey" ON public."Message" USING btree (id)` |
| Message | Message_platform_externalMessageId_idx | `CREATE INDEX "Message_platform_externalMessageId_idx" ON public."Message" USING btree (platform, "externalMessageId")` |
| PlatformConnection | PlatformConnection_businessId_platform_idx | `CREATE INDEX "PlatformConnection_businessId_platform_idx" ON public."PlatformConnection" USING btree ("businessId", platform)` |
| PlatformConnection | PlatformConnection_businessId_platform_platformAccountId_key | `CREATE UNIQUE INDEX "PlatformConnection_businessId_platform_platformAccountId_key" ON public."PlatformConnection" USING btree ("businessId", platform, "platformAccountId")` |
| PlatformConnection | PlatformConnection_pkey | `CREATE UNIQUE INDEX "PlatformConnection_pkey" ON public."PlatformConnection" USING btree (id)` |
