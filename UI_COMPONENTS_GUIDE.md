# UI Components Guide

This guide explains how to use the new standardized UI components for consistent layouts across the application.

## Layout Components

### Layout

The main layout wrapper that provides consistent structure and spacing.

```tsx
import { Layout } from '@/components/dashboard/Layout';

<Layout maxWidth="2xl">
  {/* Your page content */}
</Layout>
```

**Props:**
- `children`: ReactNode - Page content
- `className?`: string - Additional CSS classes
- `maxWidth?`: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' - Maximum content width (default: '2xl')

**Example:**
```tsx
<Layout maxWidth="xl">
  <YourPageContent />
</Layout>
```

---

### PageHeader

Standardized page header with automatic breadcrumbs, title, description, and action buttons.

```tsx
import { PageHeader } from '@/components/dashboard/PageHeader';

<PageHeader
  title="Page Title"
  description="Optional description text"
  actions={<Button>Action</Button>}
  breadcrumbs={[{ label: 'Custom', href: '/custom' }]} // Optional, auto-generated if not provided
/>
```

**Props:**
- `title`: string - Page title (required)
- `description?`: string - Page description
- `breadcrumbs?`: Array<{label: string, href?: string}> - Custom breadcrumbs (auto-generated from route if not provided)
- `actions?`: ReactNode - Action buttons or elements (right side)
- `className?`: string - Additional CSS classes

**Features:**
- Automatic breadcrumb generation from current route
- Responsive design (stacks on mobile)
- Consistent styling with gradient text

**Example:**
```tsx
<PageHeader
  title="Leads Management"
  description="Manage and track all your leads"
  actions={
    <>
      <Button variant="outline">Export</Button>
      <Button>Create Lead</Button>
    </>
  }
/>
```

---

## Loading States

### LoadingSkeleton

Flexible skeleton loader component with multiple variants.

```tsx
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';

<LoadingSkeleton variant="card" count={3} />
```

**Props:**
- `variant?`: 'card' | 'table' | 'list' | 'kpi' - Skeleton type (default: 'card')
- `count?`: number - Number of skeletons to render (default: 1)
- `className?`: string - Additional CSS classes

**Variants:**
- `card`: Generic card skeleton
- `table`: Table row skeletons
- `list`: List item skeletons
- `kpi`: KPI card skeleton

**Pre-built Components:**
```tsx
import { KPISkeleton, TableSkeleton, ListSkeleton } from '@/components/dashboard/LoadingSkeleton';

<KPISkeleton count={4} />      // Grid of 4 KPI cards
<TableSkeleton />              // Table with 5 rows
<ListSkeleton count={10} />     // List with 10 items
```

**Example:**
```tsx
{isLoading ? (
  <KPISkeleton count={4} />
) : (
  <KPICards data={data} />
)}
```

---

## Empty States

### EmptyState

Consistent empty state component for when no data is available.

```tsx
import { EmptyState } from '@/components/dashboard/EmptyState';
import { Users } from 'lucide-react';

<EmptyState
  icon={Users}
  title="No contacts found"
  description="Get started by creating your first contact"
  action={{
    label: "Create Contact",
    onClick: () => handleCreate()
  }}
/>
```

**Props:**
- `icon?`: LucideIcon - Icon component from lucide-react
- `title`: string - Empty state title (required)
- `description?`: string - Additional description text
- `action?`: {label: string, onClick: () => void} - Optional action button
- `className?`: string - Additional CSS classes
- `children?`: ReactNode - Custom content

**Example:**
```tsx
{contacts.length === 0 ? (
  <EmptyState
    icon={Users}
    title="No contacts found"
    description="Try adjusting your filters or create a new contact"
    action={{
      label: "Create Contact",
      onClick: () => navigate('/contacts/new')
    }}
  />
) : (
  <ContactsTable contacts={contacts} />
)}
```

---

## Best Practices

### 1. Always Use PageHeader

Every page should start with a `PageHeader` for consistency:

```tsx
<Layout>
  <PageHeader
    title="Page Name"
    description="What this page does"
    actions={<YourActions />}
  />
  {/* Rest of page content */}
</Layout>
```

### 2. Consistent Loading States

Use appropriate skeleton variants for different content types:

```tsx
// For KPI cards
{isLoading ? <KPISkeleton count={4} /> : <KPICards />}

// For tables
{isLoading ? <TableSkeleton /> : <DataTable />}

// For lists
{isLoading ? <ListSkeleton /> : <DataList />}
```

### 3. Handle Empty States

Always provide helpful empty states:

```tsx
{data.length === 0 ? (
  <EmptyState
    icon={Icon}
    title="No items"
    description="Helpful message"
    action={{ label: "Create", onClick: handleCreate }}
  />
) : (
  <DataDisplay data={data} />
)}
```

### 4. Spacing Consistency

Use the Layout component's built-in spacing. For additional spacing:

- Between sections: `space-y-6` or `space-y-8`
- Within cards: `p-6`
- Between grid items: `gap-6`

### 5. Responsive Design

All components are responsive by default. The PageHeader automatically:
- Stacks on mobile
- Shows breadcrumbs on larger screens
- Adjusts action button layout

---

## Migration Guide

### Updating Existing Pages

**Before:**
```tsx
<Layout>
  <div className="flex justify-between items-center mb-6">
    <h1 className="text-2xl font-bold">Page Title</h1>
    <Button>Action</Button>
  </div>
  {/* Content */}
</Layout>
```

**After:**
```tsx
<Layout>
  <PageHeader
    title="Page Title"
    actions={<Button>Action</Button>}
  />
  {/* Content */}
</Layout>
```

### Updating Loading States

**Before:**
```tsx
{isLoading ? (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="animate-pulse">...</div>
    ))}
  </div>
) : (
  <Content />
)}
```

**After:**
```tsx
{isLoading ? (
  <TableSkeleton />
) : (
  <Content />
)}
```

---

## Component File Structure

```
src/components/dashboard/
├── Layout.tsx           # Main layout wrapper
├── PageHeader.tsx       # Page header with breadcrumbs
├── LoadingSkeleton.tsx  # Loading state components
├── EmptyState.tsx       # Empty state component
├── TopNavbar.tsx        # Top navigation bar
└── Sidebar.tsx          # Sidebar (currently unused)
```

---

## Examples

### Complete Page Example

```tsx
import { Layout } from '@/components/dashboard/Layout';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoadingSkeleton, KPISkeleton } from '@/components/dashboard/LoadingSkeleton';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { Button } from '@/components/ui/button';
import { Users, Plus } from 'lucide-react';

export default function ContactsPage() {
  const { data, isLoading, error } = useContacts();

  return (
    <Layout>
      <PageHeader
        title="Contacts"
        description="Manage all your contacts"
        actions={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        }
      />

      {isLoading ? (
        <KPISkeleton count={4} />
      ) : error ? (
        <EmptyState
          icon={Users}
          title="Error loading contacts"
          description={error.message}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts found"
          description="Get started by adding your first contact"
          action={{
            label: "Add Contact",
            onClick: () => handleAdd()
          }}
        />
      ) : (
        <ContactsTable contacts={data} />
      )}
    </Layout>
  );
}
```

---

## Next Steps

1. Update remaining pages to use `PageHeader`
2. Replace custom loading states with `LoadingSkeleton`
3. Add `EmptyState` components where needed
4. Ensure consistent spacing using Layout component

