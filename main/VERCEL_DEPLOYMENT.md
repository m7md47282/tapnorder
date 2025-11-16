# Vercel Deployment Guide

This guide will help you deploy the Angular application to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Node.js 20+ installed locally (for testing)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository

2. **Configure Project**
   - **Framework Preset**: Angular
   - **Root Directory**: `main` (if your project is in a subdirectory)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/Modernize/browser`
   - **Install Command**: `npm install`

3. **Environment Variables** (if needed)
   - Add any environment variables in the Vercel dashboard
   - These will be available during build and runtime

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your application

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to project directory**
   ```bash
   cd main
   ```

4. **Deploy**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

### Method 3: GitHub Actions (Automated)

1. **Set up Vercel Secrets in GitHub**
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `VERCEL_TOKEN`: Get from [vercel.com/account/tokens](https://vercel.com/account/tokens)
     - `VERCEL_ORG_ID`: Found in your Vercel project settings
     - `VERCEL_PROJECT_ID`: Found in your Vercel project settings

2. **Push to main branch**
   - The GitHub Actions workflow will automatically deploy on push

## Configuration Files

### `vercel.json`
Main configuration file for Vercel deployment. It includes:
- Build and output directory settings
- URL rewrites for Angular routing (SPA support)
- Cache headers for static assets
- Node.js version specification

### `.github/workflows/vercel.yml`
GitHub Actions workflow for automated deployments:
- Triggers on push to main/master branch
- Builds the Angular application
- Deploys to Vercel automatically

### `.vercelignore`
Files and directories to exclude from deployment

## Important Notes

1. **Angular Routing**: The `vercel.json` includes rewrites to handle Angular's client-side routing. All routes redirect to `index.html`.

2. **Build Output**: Make sure the output directory matches your `angular.json` configuration (`dist/Modernize/browser`).

3. **Environment Variables**: If you need environment-specific variables:
   - Add them in Vercel dashboard → Project Settings → Environment Variables
   - Or use `.env` files (but don't commit sensitive data)

4. **Custom Domain**: After deployment, you can add a custom domain in Vercel dashboard → Project Settings → Domains

## Troubleshooting

### Build Fails
- Check Node.js version (should be 20+)
- Verify all dependencies are in `package.json`
- Check build logs in Vercel dashboard

### Routing Issues
- Ensure `vercel.json` has the rewrite rule for SPA routing
- Check that all routes redirect to `/index.html`

### Asset Loading Issues
- Verify `outputDirectory` in `vercel.json` matches your build output
- Check that assets are in the correct path

## Support

For more information, visit:
- [Vercel Documentation](https://vercel.com/docs)
- [Angular Deployment Guide](https://angular.io/guide/deployment)

