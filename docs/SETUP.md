# SocialSyncs HTML/CSS/JS Application

Complete social media automation platform built with HTML, CSS, JavaScript, and Supabase, based on the SocialSyncs architecture.

## Features

- **User Management**: Profile management with display name and avatar
- **Platform Credentials**: Secure storage of Instagram, YouTube, and other platform credentials
- **Post Creation**: Create and schedule posts for multiple platforms
- **Media Gallery**: Upload and manage media files
- **Instagram Integration**: Full Instagram Graph API integration for images, reels, carousels, and stories
- **YouTube Automation**: AI-powered comment automation and video management
- **API Keys**: Generate and manage API keys for programmatic access
- **OAuth Support**: Secure OAuth connections for multiple platforms

## Setup Instructions

### 1. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# Open schema.sql and copy all contents
# Paste into Supabase SQL Editor and execute
```

The schema includes:
- User profiles
- Platform credentials storage
- Posts tracking
- OAuth connections
- Media gallery
- YouTube automation tables
- API keys management
- Storage bucket configuration

### 2. Configure Application

Edit `js/config.js` to add your Supabase credentials:

```javascript
const APP_CONFIG = {
  name: 'SocialSyncs',
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  // ... other config
};
```

### 3. Storage Setup

1. In Supabase, go to Storage
2. Create a bucket named `post-media`
3. Set it to Public
4. The policies are already included in the schema.sql

### 4. Run the Application

Simply open `dashboard-socialsyncs.html` in your web browser:

```bash
# Using a local server (recommended)
npx serve .

# Or open directly
open dashboard-socialsyncs.html
```

## Usage

### First Time Setup

1. Navigate to the dashboard
2. Sign up / Sign in with Supabase Auth
3. Go to Settings and configure your profile
4. Add platform credentials (Instagram, YouTube, etc.)
5. Upload media to the gallery
6. Create your first post

### Creating Posts

1. Go to "Create Post"
2. Select platform (Instagram, Facebook, YouTube)
3. Select post type (Image, Carousel, Reel, Story)
4. Upload media or select from gallery
5. Add caption
6. Click "Create Post"

### YouTube Automation

1. Go to "YouTube" section
2. Add YouTube video IDs
3. Configure automation settings
4. Enable AI comment automation
5. Monitor comment replies

### API Access

1. Go to Settings
2. Generate API key
3. Use the key for programmatic access
4. **Important**: Save the API key securely - it won't be shown again

## File Structure

```
aiauto/
├── css/
│   ├── main.css                    # Main styles
│   ├── dashboard.css              # Dashboard styles
│   └── socialsyncs-dashboard.css  # SocialSyncs specific styles
├── js/
│   ├── config.js                   # Application configuration
│   ├── supabase.js                 # Supabase client setup
│   ├── socialsyncs.js              # SocialSyncs client library
│   └── dashboard-socialsyncs.js     # Dashboard controller
├── dashboard-socialsyncs.html       # Main dashboard
├── auth.html                       # Auth page (if separate)
├── schema.sql                      # Database schema
└── SETUP.md                        # This file
```

## Platform-Specific Setup

### Instagram

1. Create a Facebook Developer account
2. Create a Facebook App with Instagram permissions
3. Get Instagram Business Account ID
4. Generate long-lived Page Access Token
5. Add credentials in Settings

Required permissions:
- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`

### YouTube

1. Create Google Cloud project
2. Enable YouTube Data API v3
3. Create OAuth 2.0 Client ID
4. Configure callback URL
5. Add credentials in Settings

## Security Notes

- All credentials are stored encrypted in Supabase
- Row Level Security (RLS) is enabled on all tables
- Users can only access their own data
- API keys are hashed before storage
- OAuth tokens are encrypted using AES-256-GCM

## Browser Support

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Troubleshooting

### Posts not publishing
- Check platform credentials are correct
- Verify access tokens are valid
- Check Supabase storage is public
- Review console for error messages

### Media upload failing
- Ensure storage bucket is public
- Check file size limits (Supabase free tier: 50MB)
- Verify storage policies are correct

### YouTube automation not working
- Check YouTube API credentials
- Verify video IDs are correct
- Ensure OpenRouter API key is configured (for AI features)

## Development

To extend the application:

1. Add new features to `js/socialsyncs.js`
2. Update UI in `dashboard-socialsyncs.html`
3. Add styles in `css/socialsyncs-dashboard.css`
4. Update database schema if needed

## Performance Optimization

- Images are optimized automatically by Supabase
- Media gallery uses lazy loading
- Dashboard caches data where possible
- Optimized for low RAM usage

## License

This is a demonstration project based on the SocialSyncs architecture.