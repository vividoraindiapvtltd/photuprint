# Verify Template Route Setup

## Quick Verification Steps

### 1. Check Backend Server is Running
```bash
# Backend should be running on port 8080
curl http://localhost:8080/
# Should return: "PhotuPrint API is running"
```

### 2. Test Template Route Registration
```bash
# Test route (should work without auth)
curl http://localhost:8080/api/templates/test
# Should return: {"message": "Template routes are working!", ...}
```

### 3. Check Route is Registered
After restarting backend, look for in console:
```
Routes set up successfully
✅ Template routes registered at /api/templates
```

### 4. Test POST Route (requires auth)
```bash
# This will fail without auth token, but should return 401, not 404
curl -X POST http://localhost:8080/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
# Should return 401 (Unauthorized) or 400 (Bad Request), NOT 404
```

## If Getting 404 (Cannot POST)

### Check 1: Server Restarted?
- **MUST restart backend** after adding routes
- Stop server (Ctrl+C)
- Start again: `cd backend && npm start`

### Check 2: Route Registered?
Look in backend console for:
- "Routes set up successfully" ✅
- "✅ Template routes registered" ✅
- Any "Error setting up routes" ❌

### Check 3: Database Connected?
Look for:
- "MongoDB connected!!" ✅
- "MONGO db connection failed" ❌

### Check 4: Route Order
POST routes must come BEFORE GET /:id routes (already fixed)

## MongoDB Collection

**No manual creation needed!** MongoDB creates `templates` collection automatically when you save the first template.

The collection will be created with:
- Name: `templates` (plural of model name "Template")
- Indexes: Created automatically from schema
- Structure: Defined by templateSchema

## Next Steps

1. **Restart backend server**
2. **Check console logs** for route registration
3. **Test with:** `curl http://localhost:8080/api/templates/test`
4. **Try creating template** from admin panel
5. **Check backend logs** for "POST /api/templates route hit"

If you see "POST /api/templates route hit" in logs but still get error, the issue is in the controller or database.
