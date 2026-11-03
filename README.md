# TrackServ

A web-based platform that helps bridge the gap between the community and their municipal service providers.

## Features
- Report issues to municipal authorities
- Track and monitor the status of reported issues
- Simple, responsive web interface

## Tech stack
- React Js
- Supabase

## Quick start
1. Clone the repo: `git clone https://github.com/WANGAMALINDA/TrackServ.git`
2. Install dependencies (if using a packaged app): `npm install`
3. Start the app: `npm start` or open `index.html` in your browser for a static preview

## Password recovery
From User Login, enter the account email and choose **Forgot password?**. Open the emailed link and enter the new password twice. The reset page requires a valid Supabase recovery session before it accepts a new password.

The citizen login page sends Supabase password recovery emails to `https://WANGAMALINDA.github.io/TrackServ/reset-password`, including when the reset is requested from a local development server. Add this exact URL (or `https://WANGAMALINDA.github.io/TrackServ/**`) to the Supabase project's **Authentication → URL Configuration → Redirect URLs** allowlist. Do not use a localhost URL for the deployed portal.

## Profile activity and community moderation
Apply `supabase/profile_activity_and_moderation.sql` in the same Supabase project used by the Admin Portal, after the Admin Portal security SQL and `supabase/trackserv_post_reporting.sql`. This creates the profile activity feed and database functions for community moderation feedback and account-report decisions. It also adds timeline entries when a service report's status changes. The User Profile's Activity tab displays these entries and account warnings.

## Contributing
Contributions are welcome — open an issue or submit a pull request.

## License
MIT
