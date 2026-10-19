# Replit setup

## Run the site

The project uses Node.js 24 and the existing Next.js stack.

```bash
npm ci
npm run dev
```

The Replit workflow is configured as `Start application` with `npm run dev`
on port 5000.

For full AI, admin, database, notification, and ad functionality, configure
the variables described in `.env.example` using Replit Secrets or the project
environment. The public site can boot in its configured degraded mode when
optional external services are unavailable.