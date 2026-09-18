import type { FullstackEntityDef } from '../../types'

/** A ready-made entity model the user can start from (loaded via "Start from"). Every example
 *  must pass `validateEntities` with zero issues — pinned by examples.test.ts. */
export interface ExampleModel {
  id: string
  name: string
  description: string
  /** Material Symbols icon name. */
  icon: string
  entities: FullstackEntityDef[]
}

const id = (): FullstackEntityDef['fields'][number] =>
  ({ name: 'id', type: 'LONG', primaryKey: true, generated: true })

export const EXAMPLE_MODELS: ExampleModel[] = [
  {
    id: 'blog',
    name: 'Blog',
    description: 'Authors write posts; readers leave comments. Posts move through a kanban of draft → published.',
    icon: 'article',
    entities: [
      {
        name: 'Author',
        fields: [
          id(),
          { name: 'name', type: 'STRING', required: true, length: 120 },
          { name: 'email', type: 'STRING', required: true, unique: true, email: true, length: 200 },
          { name: 'bio', type: 'TEXT' },
        ],
      },
      {
        name: 'Post',
        listViews: ['table', 'cards', 'kanban'],
        fields: [
          id(),
          { name: 'title', type: 'STRING', required: true, length: 200 },
          { name: 'body', type: 'TEXT' },
          { name: 'status', type: 'ENUM', required: true, enumValues: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          { name: 'publishedAt', type: 'LOCAL_DATE_TIME' },
        ],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'author', targetEntity: 'Author', required: true }],
      },
      {
        name: 'Comment',
        fields: [
          id(),
          { name: 'body', type: 'TEXT', required: true },
          { name: 'createdOn', type: 'LOCAL_DATE', required: true },
          { name: 'approved', type: 'BOOLEAN' },
        ],
        relations: [
          { type: 'MANY_TO_ONE', fieldName: 'post', targetEntity: 'Post', required: true },
          { type: 'MANY_TO_ONE', fieldName: 'author', targetEntity: 'Author', required: false },
        ],
      },
    ],
  },
  {
    id: 'orders',
    name: 'Orders',
    description: 'Customers place orders for products; each order has lines. Orders show on a kanban and a calendar.',
    icon: 'shopping_cart',
    entities: [
      {
        name: 'Customer',
        fields: [
          id(),
          { name: 'name', type: 'STRING', required: true, length: 120 },
          { name: 'email', type: 'STRING', unique: true, email: true, length: 200 },
          { name: 'active', type: 'BOOLEAN' },
        ],
      },
      {
        name: 'Product',
        listViews: ['table', 'cards'],
        fields: [
          id(),
          { name: 'sku', type: 'STRING', required: true, unique: true, length: 40 },
          { name: 'name', type: 'STRING', required: true, length: 160 },
          { name: 'price', type: 'BIG_DECIMAL', required: true, min: 0 },
          { name: 'inStock', type: 'BOOLEAN' },
        ],
      },
      {
        name: 'Order',
        listViews: ['table', 'kanban', 'calendar'],
        fields: [
          id(),
          { name: 'reference', type: 'STRING', required: true, unique: true, length: 40 },
          { name: 'status', type: 'ENUM', required: true, enumValues: ['OPEN', 'PAID', 'SHIPPED', 'CANCELLED'] },
          { name: 'placedAt', type: 'LOCAL_DATE', required: true },
          { name: 'total', type: 'BIG_DECIMAL', min: 0 },
        ],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer', required: true }],
      },
      {
        name: 'OrderLine',
        fields: [
          id(),
          { name: 'quantity', type: 'INTEGER', required: true, min: 1, max: 1000 },
          { name: 'unitPrice', type: 'BIG_DECIMAL', min: 0 },
        ],
        relations: [
          { type: 'MANY_TO_ONE', fieldName: 'order', targetEntity: 'Order', required: true },
          { type: 'MANY_TO_ONE', fieldName: 'product', targetEntity: 'Product', required: true },
        ],
      },
    ],
  },
  {
    id: 'tickets',
    name: 'Support tickets',
    description: 'Teams of agents work tickets by priority and status, with due dates on a calendar.',
    icon: 'confirmation_number',
    entities: [
      {
        name: 'Team',
        fields: [
          id(),
          { name: 'name', type: 'STRING', required: true, unique: true, length: 80 },
        ],
      },
      {
        name: 'Agent',
        fields: [
          id(),
          { name: 'fullName', type: 'STRING', required: true, length: 120 },
          { name: 'email', type: 'STRING', required: true, unique: true, email: true, length: 200 },
        ],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'team', targetEntity: 'Team', required: false }],
      },
      {
        name: 'Ticket',
        listViews: ['table', 'kanban', 'calendar'],
        fields: [
          id(),
          { name: 'subject', type: 'STRING', required: true, length: 200 },
          { name: 'details', type: 'TEXT' },
          { name: 'priority', type: 'ENUM', required: true, enumValues: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          { name: 'status', type: 'ENUM', required: true, enumValues: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
          { name: 'dueAt', type: 'LOCAL_DATE_TIME' },
        ],
        relations: [
          { type: 'MANY_TO_ONE', fieldName: 'team', targetEntity: 'Team', required: true },
          { type: 'MANY_TO_ONE', fieldName: 'assignee', targetEntity: 'Agent', required: false },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Items stocked across warehouses, with every movement logged and shown on a calendar.',
    icon: 'inventory_2',
    entities: [
      {
        name: 'Warehouse',
        fields: [
          id(),
          { name: 'code', type: 'STRING', required: true, unique: true, length: 20 },
          { name: 'city', type: 'STRING', length: 80 },
        ],
      },
      {
        name: 'Item',
        listViews: ['table', 'cards'],
        fields: [
          id(),
          { name: 'sku', type: 'STRING', required: true, unique: true, length: 40 },
          { name: 'name', type: 'STRING', required: true, length: 160 },
          { name: 'unitCost', type: 'BIG_DECIMAL', min: 0 },
          { name: 'reorderLevel', type: 'INTEGER', min: 0 },
        ],
      },
      {
        name: 'StockMovement',
        listViews: ['table', 'calendar'],
        fields: [
          id(),
          { name: 'kind', type: 'ENUM', required: true, enumValues: ['INBOUND', 'OUTBOUND', 'ADJUSTMENT'] },
          { name: 'quantity', type: 'INTEGER', required: true },
          { name: 'movedOn', type: 'LOCAL_DATE', required: true },
          { name: 'note', type: 'STRING', length: 255 },
        ],
        relations: [
          { type: 'MANY_TO_ONE', fieldName: 'item', targetEntity: 'Item', required: true },
          { type: 'MANY_TO_ONE', fieldName: 'warehouse', targetEntity: 'Warehouse', required: true },
        ],
      },
    ],
  },
]

/** Deep copy so the loaded model can be edited without touching the catalog entry. */
export function cloneExample(example: ExampleModel): FullstackEntityDef[] {
  return JSON.parse(JSON.stringify(example.entities)) as FullstackEntityDef[]
}
