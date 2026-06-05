# FreshVeg Backend

Express backend deployed behind Firebase Hosting with a Cloud Run rewrite.

## Runtime

- Node.js `20`
- Entry point: `src/server.js`
- Express app: `src/app.js`
- Firebase Hosting public directory: `public`
- Firebase Hosting rewrite target: Cloud Run service `dailyveg-backend` in `asia-south1`

## Branch Deploys

- Push to `dev`: deploys the DEV environment via `.github/workflows/deploy-dev.yml`
- Push to `main`: deploys the PROD environment via `.github/workflows/deploy-production.yml`
- Manual deploys: both workflows also support `workflow_dispatch`

Deploy order in both workflows:

1. `npm ci`
2. `npm run lint --if-present`
3. `npm test --if-present`
4. `npm run build --if-present`
5. Deploy Cloud Run
6. Deploy Firebase Hosting

## GitHub Environments

Create these GitHub Environments:

- `dev`
- `production`

Each environment should define the same variable names and secret names, but with environment-specific values.

### Required GitHub Environment Variables

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `CLOUD_RUN_SERVICE`
- `NODE_VERSION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_SSL`
- `STORAGE_PROVIDER`
- `SUPABASE_URL`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_BUCKET_PUBLIC`
- `RAZORPAY_KEY_ID`
- `MSG91_TEMPLATE_ID`
- `OTP_BYPASS_ENABLED`
- `ENABLE_SCHEDULER`
- `ENABLE_NOTIFICATIONS_WORKER`
- `CORS_ORIGINS`

Expected production values:

- `GCP_PROJECT_ID=fresca-f3184`
- `GCP_REGION=asia-south1`
- `CLOUD_RUN_SERVICE=dailyveg-backend`
- `NODE_VERSION=20`

Expected dev values:

- `GCP_PROJECT_ID=<DEV_FIREBASE_GCP_PROJECT_ID>`
- `GCP_REGION=asia-south1`
- `CLOUD_RUN_SERVICE=dailyveg-backend`
- `NODE_VERSION=20`

### Required GitHub Environment Secrets

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

These workflows use Google Cloud Workload Identity Federation. Do not commit service account JSON files or `.env` files to the repository.

## GCP Secret Manager

Application runtime secrets stay in Google Cloud Secret Manager and are attached to Cloud Run during deploy. Create these secrets in each GCP project used by the matching GitHub Environment:

- `DB_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MSG91_AUTH_KEY`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_JOB_SECRET`

The deploy script binds those secrets with `--set-secrets` when deploying Cloud Run.

## Google Cloud Setup

Enable these APIs in each project:

- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Secret Manager API
- Firebase Management / Hosting access for the project

Create a deploy service account for GitHub Actions in each project and grant it the permissions needed to:

- authenticate through Workload Identity Federation
- deploy Cloud Run
- submit Cloud Build builds
- write images to Artifact Registry
- deploy Firebase Hosting
- act as the Cloud Run runtime service account if your project uses a custom runtime service account

Typical IAM roles for the GitHub deploy service account:

- `roles/run.admin`
- `roles/cloudbuild.builds.editor`
- `roles/artifactregistry.writer`
- `roles/firebasehosting.admin`
- `roles/iam.serviceAccountUser`

The Cloud Run runtime service account also needs access to the runtime secrets above, typically via `roles/secretmanager.secretAccessor` on the relevant secrets.

## Local Deploy Scripts

- `src/scripts/deploy-cloudrun.sh`
- `src/scripts/deploy-firebase-hosting.sh`

Both scripts now support CI-driven environment variables so GitHub Actions can reuse the same deployment logic without checked-in `.env` files.

## Manual Verification

After a workflow runs:

1. Open GitHub Actions and confirm the expected workflow completed successfully.
2. In Google Cloud, confirm a new Cloud Run revision exists for the target service.
3. Open the Firebase Hosting site for the target project and confirm it is serving.
4. Verify an API route through Hosting, for example `/v1/health`.
5. Verify the Hosting rewrite is still routing non-static requests to the correct Cloud Run service.

## Important Warning

`public/index.html` is still the default Firebase welcome page. Firebase Hosting serves matching static files before rewrites, so `/` may continue to show that placeholder page even though `/v1/*` routes are served by Cloud Run.

## PR Preview Workflow

PR preview deploys are intentionally disabled for this repository. The app is deployed through Firebase Hosting rewrites to Cloud Run, so a Hosting-only preview does not create a matching backend revision and can give misleading PR results.

The active deployment workflows remain:

- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-production.yml`

If PR previews are needed later, they should be implemented as a Cloud Run-aware preview flow rather than re-enabling the old Hosting-only workflow.
