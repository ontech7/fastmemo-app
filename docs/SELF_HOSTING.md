# Self-Hosting FastMemo on the Web

This guide explains how to self-host FastMemo as a web application.

## Prerequisites

- **Node.js** (v18 or higher)
- **Yarn** or **npm** package manager
- A **Google Firebase** account (for cloud sync functionality)
- A hosting platform (Vercel, Netlify, or any static hosting service)

## 1. Clone the Repository

```bash
git clone https://github.com/ontech7/fastmemo-app.git
cd fastmemo-app
```

## 2. Install Dependencies

```bash
yarn install
# or
npm install
```

## 3. Set Up Firebase (Optional - for Cloud Sync)

If you want to enable cloud synchronization between devices, you need to set up Firebase Firestore.

### 3.1 Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Once created, click on "Web" to add a web app to your project
4. Register your app and copy the Firebase configuration

### 3.2 Set Up Firestore

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" or "Start in test mode" (for development)
4. Select a location for your database

### 3.3 Configure Firestore Rules

Go to "Firestore Database" > "Rules" and set up appropriate security rules. For basic usage:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> **Warning**: The above rules allow anyone to read/write. For production, implement proper authentication rules.

## 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.sample .env
```

Edit the `.env` file with your configuration:

```env
# Environment (DEV, STAGE, PROD)
EXPO_PUBLIC_ENV="PROD"

# Cloud sync API URL (optional - leave empty if not using external API)
EXPO_PUBLIC_API_URL=""

# Legacy migration key — NOTE: has no runtime effect (see note below); leave empty
SECRET_KEY=""

# Sentry (optional - for error tracking)
SENTRY_AUTH_TOKEN=""
```

### About `SECRET_KEY`

> Cloud sync now uses **per-vault end-to-end encryption**: the encryption key is derived on-device from a user-chosen
> **encryption password** and is never stored in the cloud or baked into the build (see [Cloud Sync](CLOUD_SYNC.md)).
> `SECRET_KEY` is **not** the encryption boundary anymore.
>
> **It has no runtime effect.** `SECRET_KEY` lacks the `EXPO_PUBLIC_` prefix, so Expo strips it from the client bundle: the app
> runtime never sees it and reads it as `""`. Consequently, every pre-encryption ("legacy") cloud note was AES-sealed with the
> **empty string**, and the legacy→vault migration reads them back with `""`. Setting `SECRET_KEY` to any other value here does
> nothing at runtime. A fresh self-hosted deployment starts directly on the vault model and does not need it at all — leave it
> empty. (This is also why client secrets can't be hidden in the bundle, and why the vault key is derived at runtime instead.)

You can still generate a value with:

```bash
openssl rand -base64 32
```

## 5. Build for Web

Build the static web application:

```bash
npx expo export --platform web
```

This creates a `dist` folder with all static files ready for deployment.

## 6. Deployment Options

### Option A: Vercel (Recommended)

1. Install Vercel CLI:

   ```bash
   npm install -g vercel
   ```

2. Deploy:

   ```bash
   vercel --prod
   ```

   Or connect your GitHub repository to Vercel for automatic deployments.

### Option B: Netlify

1. Install Netlify CLI:

   ```bash
   npm install -g netlify-cli
   ```

2. Deploy:
   ```bash
   netlify deploy --prod --dir=dist
   ```

### Option C: Docker

Create a `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN npx expo export --platform web

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create an `nginx.conf` file:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Build and run:

```bash
docker build -t fastmemo .
docker run -p 8080:80 fastmemo
```

### Option D: Static Hosting (Apache/Nginx)

Simply upload the contents of the `dist` folder to your web server's public directory.

For Apache, create an `.htaccess` file in the dist folder:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## 7. Using Cloud Sync

Once deployed, users can set up cloud sync directly in the app:

1. Open Settings in FastMemo
2. Navigate to "Cloud" section
3. Enter Firebase credentials:
   - **API Key**: Found in Firebase Console > Project Settings
   - **Project ID**: Your Firebase project ID
   - **App ID**: Your Firebase web app ID
4. Click "Connect" to establish synchronization

Each user provides their own Firebase credentials, making the app fully decentralized.

## 8. Environment Variables for Hosting Platforms

When deploying to platforms like Vercel or Netlify, set these environment variables in the platform's dashboard:

| Variable            | Description                                          | Required |
| ------------------- | ---------------------------------------------------- | -------- |
| `EXPO_PUBLIC_ENV`   | Environment mode (`DEV`, `STAGE`, `PROD`)            | Yes      |
| `SECRET_KEY`        | Legacy key — no runtime effect, leave empty (see §4) | No       |
| `SENTRY_AUTH_TOKEN` | Sentry authentication token                          | No       |

## 9. Updating the Application

To update your self-hosted instance:

```bash
git pull origin main
yarn install
npx expo export --platform web
# Re-deploy using your chosen method
```

## Troubleshooting

### Build Errors

If you encounter build errors, try:

```bash
yarn clean:all
yarn install
npx expo export --platform web
```

### Firebase Connection Issues

- Verify your Firebase credentials are correct
- Check that Firestore is enabled in your Firebase project
- Ensure your Firestore security rules allow the required operations

### Blank Page After Deployment

- Ensure your hosting platform is configured for SPA (Single Page Application) routing
- Check browser console for JavaScript errors
- Verify all environment variables are set correctly

## Security Considerations

1. **HTTPS**: Always serve your application over HTTPS
2. **Firebase Rules**: Implement proper Firestore security rules for production
3. **Encryption**: Cloud data is end-to-end encrypted per-vault from a user-chosen password (see [Cloud Sync](CLOUD_SYNC.md)).
   `SECRET_KEY` is not the security boundary and has no runtime effect (it is stripped from the client bundle); legacy cloud
   data was effectively sealed with an empty key and is migrated automatically. Do not rely on `SECRET_KEY` for confidentiality
4. **Content Security Policy**: Consider adding CSP headers to your server configuration

## Support

For issues and feature requests, please open an issue on [GitHub](https://github.com/ontech7/fastmemo-app/issues).
