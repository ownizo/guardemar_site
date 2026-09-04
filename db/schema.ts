import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const applicationRole = pgEnum('application_role', ['customer', 'staff', 'admin'])
export const propertyType = pgEnum('property_type', ['villa', 'apartment', 'townhouse', 'other'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  role: applicationRole('role').notNull().default('customer'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  ...timestamps,
})

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  taxNumber: text('tax_number'),
  billingAddress: text('billing_address'),
  country: text('country').notNull().default('Portugal'),
  internalNotes: text('internal_notes'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (table) => [
  index('clients_name_idx').on(table.lastName, table.firstName),
  index('clients_email_idx').on(table.email),
  index('clients_phone_idx').on(table.phone),
  index('clients_tax_number_idx').on(table.taxNumber),
])

export const clientUsers = pgTable('client_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  relationshipLabel: text('relationship_label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('client_users_client_user_uidx').on(table.clientId, table.userId),
  index('client_users_user_idx').on(table.userId),
])

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'restrict' }),
  displayName: text('display_name').notNull(),
  addressLine1: text('address_line_1').notNull(),
  addressLine2: text('address_line_2'),
  postalCode: text('postal_code').notNull(),
  locality: text('locality').notNull(),
  municipality: text('municipality').notNull(),
  country: text('country').notNull().default('Portugal'),
  propertyType: propertyType('property_type').notNull().default('other'),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  hasPool: boolean('has_pool').notNull().default(false),
  hasGarden: boolean('has_garden').notNull().default(false),
  hasIrrigation: boolean('has_irrigation').notNull().default(false),
  hasAlarm: boolean('has_alarm').notNull().default(false),
  accessNotesPrivate: text('access_notes_private'),
  internalNotes: text('internal_notes'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, (table) => [
  index('properties_client_idx').on(table.clientId),
  index('properties_locality_idx').on(table.locality),
])

export const propertyUsers = pgTable('property_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('property_users_property_user_uidx').on(table.propertyId, table.userId),
  index('property_users_user_idx').on(table.userId),
  index('property_users_property_idx').on(table.propertyId),
])

export const staffProfiles = pgTable('staff_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  roleTitle: text('role_title').notNull(),
  active: boolean('active').notNull().default(true),
  photoUrl: text('photo_url'),
  ...timestamps,
}, (table) => [index('staff_profiles_user_idx').on(table.userId)])

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id'),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_events_actor_idx').on(table.actorUserId),
  index('audit_events_entity_idx').on(table.entityType, table.entityId),
  index('audit_events_created_idx').on(table.createdAt),
])
