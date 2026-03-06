# ✅ Template Update - Remove Existing Images Feature

## What Was Added

Admins can now **remove existing template images** when updating a template.

---

## Features

### ✅ Display Existing Files
- Shows all existing template images when editing
- Images displayed as thumbnails
- Supports both Cloudinary URLs and local file URLs

### ✅ Remove Existing Files
- Click on an image to mark it for removal
- Red border = marked for removal
- Green checkmark = will be removed
- Click again to undo removal

### ✅ Add New Files
- Can still add new template images
- New files are added to remaining existing files

### ✅ Validation
- Ensures at least one template file remains
- Prevents deleting all files

### ✅ Cloudinary Cleanup
- Removed files are deleted from Cloudinary
- Old preview images deleted when replaced

---

## How It Works

### Frontend Flow

1. **Edit Template:**
   - Click "Edit" on a template
   - Existing files displayed as thumbnails
   - Can click to mark for removal

2. **Mark Files for Removal:**
   - Click on existing image → Red border appears
   - Image marked for removal
   - Click again → Removes mark

3. **Add New Files:**
   - Select new files from file input
   - New files shown separately
   - Will be added to template

4. **Submit Update:**
   - Removed files sent to backend as JSON array
   - New files uploaded to Cloudinary
   - Backend removes marked files from Cloudinary

### Backend Flow

1. **Receive Update Request:**
   - `removeTemplateFiles` field contains JSON array of URLs to remove
   - New files in `req.files.templateFiles`

2. **Delete from Cloudinary:**
   - Extract public ID from each URL
   - Call `cloudinary.uploader.destroy(publicId)`
   - Log deletion

3. **Update Template:**
   - Remove URLs from `templateFiles` array
   - Add new uploaded file URLs
   - Save to database

---

## UI Changes

### Existing Files Display
```
Existing Template Files:
[Image 1] [Image 2] [Image 3]
Click on an image to mark it for removal
```

### Marked for Removal
```
[Image 1] [Image 2 ✕] [Image 3]
         (red border)
         "Will Remove" label
```

### Warning Message
```
⚠️ 2 file(s) will be removed. Make sure at least one file remains.
```

---

## Code Changes

### Frontend (`admin-cms/src/components/TemplateManager.js`)

**New State:**
```javascript
const [existingFilesToRemove, setExistingFilesToRemove] = useState([])
```

**New Function:**
```javascript
const handleRemoveExistingFile = (fileUrl) => {
  if (existingFilesToRemove.includes(fileUrl)) {
    // Undo removal
    setExistingFilesToRemove(existingFilesToRemove.filter(url => url !== fileUrl))
  } else {
    // Mark for removal
    setExistingFilesToRemove([...existingFilesToRemove, fileUrl])
  }
}
```

**Form Submission:**
```javascript
if (editingId && existingFilesToRemove.length > 0) {
  templateData.append("removeTemplateFiles", JSON.stringify(existingFilesToRemove))
}
```

### Backend (`backend/controllers/template.controller.js`)

**File Removal Logic:**
```javascript
const { removeTemplateFiles } = req.body
if (removeTemplateFiles) {
  const filesToRemove = JSON.parse(removeTemplateFiles)
  
  // Delete from Cloudinary
  for (const fileUrl of filesToRemove) {
    if (fileUrl.includes("cloudinary.com")) {
      const publicId = extractPublicId(fileUrl)
      await cloudinary.uploader.destroy(publicId)
    }
  }
  
  // Remove from array
  existingTemplateFiles = existingTemplateFiles.filter(
    url => !filesToRemove.includes(url)
  )
}
```

---

## Testing

### Test Remove Existing Files
1. Go to Template Manager
2. Click "Edit" on a template with multiple images
3. Click on an existing image → Should show red border
4. Click "Update Template"
5. Image should be removed from template ✅
6. Check Cloudinary → File should be deleted ✅

### Test Add + Remove
1. Edit template
2. Mark 1 existing file for removal
3. Add 2 new files
4. Update template
5. Should have: (original - 1) + 2 = new total ✅

### Test Validation
1. Edit template with 1 image
2. Try to mark it for removal
3. Add no new files
4. Try to update
5. Should show error: "At least one template file is required" ✅

---

## Benefits

✅ **Full Control** - Admins can manage all template images
✅ **Clean Storage** - Removed files deleted from Cloudinary
✅ **Visual Feedback** - Clear indication of files to remove
✅ **Safe Operation** - Validation prevents deleting all files
✅ **Undo Support** - Can unmark files before submitting

---

## Summary

✅ Existing files displayed when editing
✅ Click to mark/unmark for removal
✅ Removed files deleted from Cloudinary
✅ New files can still be added
✅ Validation ensures at least one file remains

**Template update now supports full image management!** 🎉
