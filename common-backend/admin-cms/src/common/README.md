# 🚀 Reusable Components Library

This folder contains reusable components that can be used across all components in the admin CMS. These components provide consistent UI patterns and reduce code duplication.

## 📁 Available Components

### 1. **PageHeader** - Page Title and Subtitle
```jsx
import { PageHeader } from '../common';

<PageHeader
  title="Page Title"
  subtitle="Page description or instructions"
  isEditing={false}
  editText="Edit Item"
  createText="Add New Item"
  className="custom-class"
/>
```

**Props:**
- `title` - Main page title
- `subtitle` - Page description
- `isEditing` - Boolean to show edit/create mode
- `editText` - Text when editing (default: "Edit")
- `createText` - Text when creating (default: "Add New")
- `className` - Additional CSS classes

---

### 2. **AlertMessage** - Success/Error Messages
```jsx
import { AlertMessage } from '../common';

<AlertMessage
  type="success" // or "error"
  message="Operation completed successfully!"
  onClose={() => setMessage("")}
  autoClose={true}
  autoCloseDelay={3000}
  className="custom-class"
/>
```

**Props:**
- `type` - "success" or "error"
- `message` - Message text to display
- `onClose` - Function to clear message
- `autoClose` - Auto-hide after delay
- `autoCloseDelay` - Delay in milliseconds
- `className` - Additional CSS classes

---

### 3. **ViewToggle** - Card/List View Switcher
```jsx
import { ViewToggle } from '../common';

<ViewToggle
  viewMode="card" // or "list"
  onViewChange={handleViewModeChange}
  disabled={false}
  cardText="Cards"
  listText="List"
  className="custom-class"
/>
```

**Props:**
- `viewMode` - Current view mode
- `onViewChange` - Function to change view
- `disabled` - Disable toggle buttons
- `cardText` - Text for card button
- `listText` - Text for list button
- `className` - Additional CSS classes

---

### 4. **Pagination** - Page Navigation with "Go to Page"
```jsx
import { Pagination } from '../common';

<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={handlePageChange}
  disabled={false}
  showGoToPage={true}
  className="custom-class"
/>
```

**Props:**
- `currentPage` - Current page number
- `totalPages` - Total number of pages
- `onPageChange` - Function to change page
- `disabled` - Disable pagination
- `showGoToPage` - Show "Go to Page" input
- `className` - Additional CSS classes

---

### 5. **EntityCard** - Reusable Card for Any Entity
```jsx
import { EntityCard } from '../common';

<EntityCard
  entity={brand}
  logoField="logo"
  nameField="name"
  idField="_id"
  onEdit={handleEdit}
  onDelete={handleDelete}
  loading={false}
  logoPlaceholderColor={generateBrandColor(brand._id, brand.name)}
  renderDetails={(entity) => (
    <div>Custom details for {entity.name}</div>
  )}
  renderActions={(entity) => (
    <div>Custom actions for {entity.name}</div>
  )}
  className="brandCard"
/>
```

**Props:**
- `entity` - The entity object to display
- `logoField` - Field name for logo/image
- `nameField` - Field name for display name
- `idField` - Field name for unique ID
- `onEdit` - Edit function
- `onDelete` - Delete function
- `loading` - Loading state
- `logoPlaceholderColor` - Color for logo placeholder
- `renderDetails` - Custom details renderer
- `renderActions` - Custom actions renderer
- `className` - Additional CSS classes

---

### 6. **FormField** - Reusable Form Input
```jsx
import { FormField } from '../common';

<FormField
  type="text" // text, textarea, file, number
  name="fieldName"
  label="Field Label"
  value={formData.fieldName}
  onChange={handleChange}
  placeholder="Enter value..."
  required={true}
  disabled={false}
  info="Help text or instructions"
  rows={3} // for textarea
  accept="image/*" // for file
  min={0} // for number
  max={100} // for number
  maxLength={15} // character limit
  uppercase={false} // auto-convert to uppercase
  alphanumeric={false} // only allow A-Z, a-z, 0-9
  className="custom-class"
/>
```

**Props:**
- `type` - Input type (text, textarea, file, number)
- `name` - Field name
- `label` - Field label
- `value` - Field value
- `onChange` - Change handler
- `placeholder` - Placeholder text
- `required` - Required field
- `disabled` - Disable field
- `info` - Help text
- `rows` - Rows for textarea
- `accept` - File types for file input
- `min/max` - Min/max for number input
- `maxLength` - Maximum character limit for text inputs
- `uppercase` - Auto-convert input to uppercase
- `alphanumeric` - Only allow alphanumeric characters (A-Z, a-z, 0-9)
- `className` - Additional CSS classes

**Special Features:**
- **Uppercase**: Automatically converts input to uppercase (perfect for GST numbers, codes, etc.)
- **Alphanumeric**: Filters out special characters, keeping only letters and numbers
- **Character Limit**: Set maximum character length with visual feedback
- **Character Counter**: Shows character count (e.g., "12/15") with color coding
- **Combined**: Use all features together for fields like GST numbers

**GST Number Example:**
```jsx
<FormField
  type="text"
  name="gstNo"
  label="GST Number"
  value={formData.gstNo}
  onChange={handleChange}
  placeholder="Enter GST Number (15 characters)"
  uppercase={true}
  alphanumeric={true}
  maxLength={15}
  info="GST number must be exactly 15 characters (automatically converted to uppercase, alphanumeric only)"
/>
```

---

### 7. **ActionButtons** - Edit/Delete Buttons
```jsx
import { ActionButtons } from '../common';

<ActionButtons
  onEdit={handleEdit}
  onDelete={handleDelete}
  loading={false}
  size="normal" // normal, small, large
  editText="✏️ Edit"
  deleteText="🗑️ Delete"
  editTitle="Edit Item"
  deleteTitle="Delete Item"
  className="custom-class"
/>
```

**Props:**
- `onEdit` - Edit function
- `onDelete` - Delete function
- `loading` - Loading state
- `size` - Button size (normal, small, large)
- `editText` - Edit button text
- `deleteText` - Delete button text
- `editTitle` - Edit button tooltip
- `deleteTitle` - Delete button tooltip
- `className` - Additional CSS classes

---

## 🎨 Color Utilities

### **generateBrandColor(brandId, brandName)**
Generates unique colors for brand logo placeholders with 4 color schemes.

### **generateEntityColor(entityId, entityName)**
Generates professional colors for any entity with 3 color schemes.

### **generateTextColor(text)**
Generates colors from text strings for tags/labels.

### **generateContrastColor(backgroundColor)**
Generates contrasting text colors for readability.

---

## 🔧 Usage Examples

### **Complete Brand Manager Example:**
```jsx
import { 
  PageHeader, 
  AlertMessage, 
  ViewToggle, 
  Pagination, 
  EntityCard, 
  FormField, 
  ActionButtons,
  generateBrandColor 
} from '../common';

const BrandManager = () => {
  // ... state and functions

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Brand Management"
        subtitle="Manage your brand information and company details"
        isEditing={!!editingId}
        editText="Edit Brand"
        createText="Add New Brand"
      />

      <AlertMessage
        type="success"
        message={success}
        onClose={() => setSuccess("")}
        autoClose={true}
      />

      <AlertMessage
        type="error"
        message={error}
        onClose={() => setError("")}
        autoClose={true}
      />

      {/* Form with FormField components */}
      <div className="brandFormContainer">
        <form onSubmit={handleSubmit}>
          <FormField
            type="text"
            name="name"
            label="Brand Name"
            value={formData.name}
            onChange={handleChange}
            required={true}
          />
          {/* ... more fields */}
        </form>
      </div>

      {/* View toggle */}
      <ViewToggle
        viewMode={viewMode}
        onViewChange={handleViewModeChange}
        disabled={loading}
      />

      {/* Cards with EntityCard */}
      {viewMode === 'card' && (
        <div className="brandsGrid">
          {brands.map(brand => (
            <EntityCard
              key={brand._id}
              entity={brand}
              onEdit={handleEdit}
              onDelete={handleDelete}
              logoPlaceholderColor={generateBrandColor(brand._id, brand.name)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        disabled={loading}
      />
    </div>
  );
};
```

---

## 🎯 Benefits

1. **Consistency** - All components use the same design patterns
2. **Reusability** - Use the same component across different pages
3. **Maintainability** - Update once, affects everywhere
4. **Professional Look** - Enterprise-grade UI components
5. **Easy Integration** - Simple props and flexible customization
6. **Responsive Design** - Mobile-friendly by default

---

## 🔍 SearchField Component

A reusable search input component with built-in clear functionality and search icon.

**Props:**
- `value` (string): Current search query value
- `onChange` (function): Function called when search input changes
- `placeholder` (string, optional): Placeholder text for the search input
- `disabled` (boolean, optional): Whether the search input is disabled
- `className` (string, optional): Additional CSS classes
- `minWidth` (string, optional): Minimum width of the search input (default: "200px")
- `clearable` (boolean, optional): Whether to show clear button (default: true)
- `onClear` (function, optional): Custom clear function (if not provided, uses onChange with empty value)
- `searchIcon` (boolean, optional): Whether to show search icon (default: true)

**Usage Example:**
```jsx
import { SearchField } from '../common';

const MyComponent = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SearchField
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search items..."
      minWidth="300px"
      onClear={() => setSearchQuery("")}
    />
  );
};
```

**Features:**
- 🔍 Search icon on the left
- ✕ Clear button on the right (when there's text)
- Responsive design with customizable width
- Consistent styling across components
- Built-in clear functionality

---

## 🚀 Getting Started

1. **Import components:**
   ```jsx
   import { ComponentName } from '../common';
   ```

2. **Use in your component:**
   ```jsx
   <ComponentName prop1="value1" prop2="value2" />
   ```

3. **Customize with props:**
   ```jsx
   <ComponentName 
     prop1="value1" 
     className="custom-class"
     customProp="custom-value"
   />
   ```

4. **Extend with render props:**
   ```jsx
   <EntityCard
     entity={item}
     renderDetails={(item) => <CustomDetails item={item} />}
     renderActions={(item) => <CustomActions item={item} />}
   />
   ```

---

## 🔍 Component Relationships

- **PageHeader** → Used at the top of every page
- **AlertMessage** → Used for success/error feedback
- **FormField** → Used in all forms
- **EntityCard** → Used for displaying any entity
- **ActionButtons** → Used in cards and tables
- **ViewToggle** → Used for switching view modes
- **Pagination** → Used for large data sets
- **SearchField** → Used for search functionality across components

---

## 💡 Best Practices

1. **Always use these components** instead of creating custom ones
2. **Customize with props** rather than modifying the component
3. **Use render props** for complex customizations
4. **Keep consistent styling** by using the provided CSS classes
5. **Test responsiveness** on different screen sizes
6. **Follow the established patterns** for consistency

---

## 🎨 CSS Classes

All components use consistent CSS classes that are defined in `styles.css`. The main classes are:

- `.entityCard` - Card container
- `.entityCardHeader` - Card header section
- `.entityLogo` - Logo/image container
- `.entityInfo` - Information section
- `.entityCardActions` - Action buttons section
- `.formField` - Form field container
- `.actionButtons` - Action buttons container

---

## 🔧 Troubleshooting

### **Component not rendering:**
- Check import path is correct
- Verify all required props are provided
- Check browser console for errors

### **Styling issues:**
- Ensure `styles.css` is imported
- Check if custom CSS classes conflict
- Verify responsive breakpoints

### **Props not working:**
- Check prop names match exactly
- Verify prop types are correct
- Ensure functions are properly bound

---

## 📚 Additional Resources

- **Base CSS**: `src/css/base.css` - Foundation styles
- **Component CSS**: `src/css/styles.css` - Component-specific styles
- **Color Utils**: `src/utils/colorUtils.js` - Color generation functions
- **API Utils**: `src/api/axios.js` - HTTP client configuration

---

**Happy coding! 🚀** 

# Common Components Documentation

## StatusFilter Component

The `StatusFilter` component provides a reusable way to filter entities by their status across all manager components.

### Basic Usage

```jsx
import { StatusFilter, calculateStandardStatusCounts } from '../common';

const MyManager = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [entities, setEntities] = useState([]);
  
  return (
    <StatusFilter
      statusFilter={statusFilter}
      onStatusChange={setStatusFilter}
      counts={calculateStandardStatusCounts(entities)}
      disabled={loading}
    />
  );
};
```

### Props

- `statusFilter` (string): Current active status filter ('all', 'active', 'inactive', 'deleted')
- `onStatusChange` (function): Callback when status filter changes
- `counts` (object): Object containing count for each status
- `disabled` (boolean): Whether the filter is disabled
- `className` (string): Additional CSS classes
- `statusOptions` (array): Custom status options (optional)
- `showCounts` (boolean): Whether to show counts in buttons (default: true)

### Custom Status Options

For entities with custom status fields, you can provide custom status options:

```jsx
const customStatusOptions = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' }
];

<StatusFilter
  statusFilter={statusFilter}
  onStatusChange={setStatusFilter}
  counts={calculateCustomStatusCounts(entities, 'status', {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  })}
  statusOptions={customStatusOptions}
/>
```

## Status Utility Functions

### calculateStandardStatusCounts(entities)

Calculates counts for entities with standard `isActive` and `deleted` fields.

**Parameters:**
- `entities` (array): Array of entity objects

**Returns:**
```javascript
{
  total: 10,
  active: 7,
  inactive: 2,
  deleted: 1
}
```

### calculateCustomStatusCounts(entities, statusField, statusMapping)

Calculates counts for entities with custom status fields.

**Parameters:**
- `entities` (array): Array of entity objects
- `statusField` (string): Field name containing status
- `statusMapping` (object): Mapping of status values to labels

**Returns:**
```javascript
{
  total: 10,
  pending: 3,
  approved: 5,
  rejected: 2
}
```

### filterEntitiesByStatus(entities, statusFilter, statusField)

Filters entities based on status filter.

**Parameters:**
- `entities` (array): Array of entity objects
- `statusFilter` (string): Status to filter by
- `statusField` (string): Custom status field name (optional)

**Returns:** Filtered array of entities

### createStatusOptions(counts, customOptions)

Creates status options array for StatusFilter component.

**Parameters:**
- `counts` (object): Status counts object
- `customOptions` (array): Custom status options (optional)

**Returns:** Array of status options with counts

## Implementation Example

Here's how to implement status filtering in a manager component:

```jsx
import React, { useState, useMemo } from 'react';
import { 
  StatusFilter, 
  calculateStandardStatusCounts, 
  filterEntitiesByStatus 
} from '../common';

const EntityManager = () => {
  const [entities, setEntities] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter entities based on status and search
  const filteredEntities = useMemo(() => {
    let filtered = entities;
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(entity => 
        entity.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [entities, searchQuery, statusFilter]);
  
  return (
    <div>
      <h2>Entities ({filteredEntities.length})</h2>
      
      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={calculateStandardStatusCounts(entities)}
      />
      
      {/* Render filtered entities */}
      {filteredEntities.map(entity => (
        <div key={entity._id}>{entity.name}</div>
      ))}
    </div>
  );
};
```

## CSS Classes

The component uses the following CSS classes:

- `.statusFilters` - Container for status filter buttons
- `.statusFilterBtn` - Individual status filter button
- `.statusFilterBtn.active` - Active status filter button
- `.statusFilterBtn:hover` - Hover state for buttons

Make sure these styles are available in your CSS file. 