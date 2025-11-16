# Vercel Deployment Troubleshooting

## Issue: "ng: command not found"

### Problem
Vercel is trying to run `ng build` directly, but Angular CLI is not available in the PATH.

### Solution
The `vercel.json` has been updated to:
1. Set `framework: null` to prevent Vercel's auto-detection
2. Use `npm run build` instead of `ng build` directly
3. Ensure `npm ci` runs before build to install dependencies

### Manual Deployment Settings

If deploying via Vercel Dashboard, use these settings:

**Build & Development Settings:**
- **Framework Preset**: Other (or leave blank)
- **Root Directory**: `main` (if your project is in a subdirectory)
- **Build Command**: `npm ci && npm run build -- --configuration production`
- **Output Directory**: `dist/Modernize/browser`
- **Install Command**: `npm ci`
- **Node.js Version**: 20.x

### Alternative: Update package.json build script

If the issue persists, you can also update the build script in `package.json`:

```json
{
  "scripts": {
    "build": "npx ng build --configuration production",
    "build:prod": "ng build --configuration production"
  }
}
```

### Verify Angular CLI Installation

Make sure `@angular/cli` is in `devDependencies`:
```bash
npm install --save-dev @angular/cli
```

### Check Build Locally

Before deploying, test the build locally:
```bash
cd main
npm ci
npm run build -- --configuration production
```

The output should be in `dist/Modernize/browser/`

