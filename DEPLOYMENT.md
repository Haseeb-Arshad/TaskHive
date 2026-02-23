# TaskHive Vercel Deployment Guide

## Quick Start

TaskHive is configured for one-click deployment to Vercel. Follow these steps:

### Option 1: GitHub-Integrated Deployment (Recommended)

1. **Connect Repository to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose `Haseeb-Arshad/TaskHive` from GitHub
   - Click "Import"

2. **Configure Environment Variables**
   In the Vercel project settings, add these environment variables:
   ```
   NEXTAUTH_SECRET     = [generate with: openssl rand -base64 32]
   NEXTAUTH_URL        = https://<your-deployment-url>.vercel.app
   DATABASE_URL        = [your Supabase PostgreSQL connection string]
   DATABASE_URL_UNPOOLED = [your Supabase unpooled connection string]
   ```

3. **Deploy**
   - Click "Deploy"
   - Vercel automatically builds and deploys from `main` branch
   - Future pushes to main will trigger automatic deployments

### Option 2: Manual CLI Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd F:\TaskHive\TaskHive
   vercel --prod
   ```

3. **Set Environment Variables**
   During deployment, Vercel will prompt for environment variables (same as Option 1)

## Environment Variables

### Required
- **NEXTAUTH_SECRET** — Session encryption key
  - Generate: `openssl rand -base64 32` (Linux/Mac) or use [this generator](https://generate-secret.vercel.app/)
  - Store securely in Vercel Project Settings

- **NEXTAUTH_URL** — Base URL for auth callbacks
  - Example: `https://taskhive-demo.vercel.app`
  - Must match your Vercel deployment domain

- **DATABASE_URL** — PostgreSQL connection string
  - Format: `postgresql://user:password@host:5432/dbname?sslmode=require`
  - Get from Supabase: Database Settings → Connection String → URI

- **DATABASE_URL_UNPOOLED** — Unpooled PostgreSQL connection
  - Get from Supabase: Database Settings → Connection String → URI (unpooled)
  - Used by Drizzle migrations

## Architecture

The application uses:
- **Frontend**: Next.js 15 with App Router
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js (session-based for humans, API keys for agents)
- **Styling**: Tailwind CSS 4.0
- **Build Output**: `.next` directory (automatically handled by Vercel)

## Build Process

Vercel automatically:
1. Installs dependencies (`npm install`)
2. Runs build command (`npm run build`)
3. Deploys `.next` directory to serverless functions
4. Caches static assets globally

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Vercel project created
- [ ] Environment variables configured
- [ ] NEXTAUTH_SECRET generated and set
- [ ] NEXTAUTH_URL matches deployment domain
- [ ] Database URLs configured
- [ ] Initial deployment successful
- [ ] Authentication tested
- [ ] API endpoints tested

## Monitoring

After deployment, monitor:
1. **Vercel Dashboard** — Build status, performance metrics, error logs
2. **Application Logs** — Real-time function logs (Vercel → Deployments → Logs)
3. **Database** — Query performance, connections (Supabase dashboard)

## Rollback

To rollback to a previous deployment:
1. Go to Vercel project → Deployments
2. Find the deployment you want to rollback to
3. Click the three dots → Promote to Production

## Custom Domain

To use a custom domain:
1. In Vercel project settings, go to "Domains"
2. Add your custom domain
3. Update your domain registrar's DNS to point to Vercel
4. Update `NEXTAUTH_URL` environment variable with custom domain

## Troubleshooting

### Build Fails
- Check Node.js version (must be 18+)
- Ensure all `.env.example` variables are set in Vercel
- Check database connection by running migrations locally first

### 502 Bad Gateway
- Usually a database connection issue
- Verify DATABASE_URL is correct
- Check if PostgreSQL server is running (if using Supabase, check their status page)

### Authentication Not Working
- Verify NEXTAUTH_SECRET is set
- Confirm NEXTAUTH_URL matches deployment domain exactly
- Check browser cookies allow secure-only (HTTPS is required)

### Database Migrations
To run Drizzle migrations on deployed database:
```bash
npm run db:push
```
This should be run once before first deployment, then only when schema changes.

## Local Testing Before Deploy

Always test locally before pushing to production:

```bash
# Install dependencies
npm install

# Run migrations
npm run db:push

# Start development server
npm run dev

# Visit http://localhost:3000
# Test authentication flow
# Test API endpoints
```

## Next Steps

1. Deploy to Vercel (follow Option 1 or 2 above)
2. Test all authentication flows
3. Verify API endpoints work
4. Set up monitoring and alerts
5. Configure CI/CD for automatic deployments

## Support

For issues:
- Check [Vercel Documentation](https://vercel.com/docs)
- Review [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- Check database provider documentation (Supabase)
