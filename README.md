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

The citizen login page sends Supabase password recovery emails to `/TrackServ/reset-password`. Add the deployed redirect URL (for example, `https://WANGAMALINDA.github.io/TrackServ/reset-password`) to the Supabase project's **Authentication → URL Configuration → Redirect URLs** allowlist.

## Contributing
Contributions are welcome — open an issue or submit a pull request.

## License
MIT
