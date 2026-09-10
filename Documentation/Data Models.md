# TrackServ Data Models

## 1. Scope and conventions

TrackServ is implemented as two React applications that share one Supabase PostgreSQL project:

- **Citizen portal**: reporting, tracking, voting, community, profile, and services marketplace.
- **Administrative portal**: report triage, locations, assignments, analytics, and staff workflow.

The models below are consolidated from the project proposal, the supplied ERD, and the database fields used by the applications. Fields explicitly read or written by the source code are marked **implemented**. Fields visible in the supplied ERD or required by the documented workflow are marked **documented**. Exact nullability, defaults, indexes, and foreign-key actions should be confirmed against the live Supabase schema before production deployment.

Unless otherwise stated:

- Primary keys are UUIDs.
- Timestamps are PostgreSQL `timestamptz` values in UTC.
- Foreign keys reference the related table's `id`.
- `auth.users` is Supabase Auth's managed identity table and is not duplicated by the application.

## 2. Identity and access models

### 2.1 `auth.users` (Supabase managed)

Stores authentication identities, credentials, email addresses, and user metadata. The applications obtain the current identity through `supabase.auth.getUser()`.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key and identity used by application profile and ownership relationships. |
| `email` | text | Authenticated email address. |
| `user_metadata` | JSON | Registration metadata, including the optional full name. |
| Auth timestamps | timestamptz | Managed creation, confirmation, and last-sign-in values. |

### 2.2 `profiles`

Application profile for a Supabase Auth user. The profile is created after registration or lazily when a user opens their profile.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key; one-to-one relationship with `auth.users.id`. |
| `full_name` | text | Display name. |
| `username` | text | Public or account username. |
| `email` | text | Application-level email copy used by the profile screen. |
| `phone` | text | Optional contact number. |
| `location` | text | User's stated location; defaults in the client to Tshwane Municipality for new profiles. |
| `about` | text | Optional profile biography. |
| `profile_picture` | text | Public image URL for the avatar. |
| `role` | text | Access role. Observed values include `citizen` and `staff`; the admin login also expects an administrator role. |
| `email_notifications` | boolean | Whether email notifications are enabled. |
| `public_profile` | boolean | Whether the profile is public. |
| `created_at` | timestamptz | Profile creation/member-since date. |
| `updated_at` | timestamptz | Last profile update, if present. |

## 3. Civic reporting models

### 3.1 `categories`

Reference data for civic issue categories shared by the citizen and admin portals.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `category_name` | text | Category label, such as Roads & Infrastructure, Water Leak, Electricity, Garbage, or Other. |
| `description` | text | Optional category description. |
| `created_at` | timestamptz | Creation timestamp if enabled. |

### 3.2 `reports`

The central aggregate in TrackServ. A report can originate from a citizen form or be entered manually by an administrator for an issue received through another channel.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `user_id` | UUID | Reporter/creator; references `profiles.id` and the Supabase Auth user. |
| `category_id` | UUID | References `categories.id`. |
| `title` | text | Report title; may be absent for citizen submissions, where the UI derives a title from the description/category. |
| `description` | text | Main issue description; citizen input is limited to 500 characters in the UI. |
| `additional_information` | text | Optional extra information; citizen input is limited to 300 characters in the UI. |
| `location` | text | Human-readable address or location description. |
| `latitude` | numeric | Latitude captured, searched, or selected on the map. |
| `longitude` | numeric | Longitude captured, searched, or selected on the map. |
| `status` | text | Workflow state. Observed values are `open`, `in_progress`, `under_review`, `resolved`, `closed`, and `rejected`. |
| `severity` | text | Priority/severity, observed as `Low`, `Medium`, or `High`. |
| `votes` | integer | Denormalised vote count used for prioritisation and analytics. |
| `assigned_to` | UUID | Optional assigned staff member; references `profiles.id` where `role = 'staff'`. |
| `assigned_to_group_id` | UUID | Optional assigned team/group; references `groups.id` where that model is enabled. |
| `assigned_at` | timestamptz | Time the report was assigned. |
| `started_at` | timestamptz | Time staff started attendance/work. |
| `proof_image_url` | text | Completion/proof image URL used by the admin workflow. |
| `resolution_notes` | text | Completion notes entered by an administrator. |
| `created_at` | timestamptz | Submission/creation time. |
| `updated_at` | timestamptz | Last status, assignment, or report update. |

Recommended status domain: `open -> under_review -> in_progress -> resolved -> closed`, with `rejected` as a terminal exception. The interfaces also allow returning work to `open`.

### 3.3 `report_images`

Images attached to a report. Citizen submissions support up to five images, with a documented maximum of 5 MB per image. Staff can add a completion/proof image through the same table.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | References `reports.id`. |
| `image_url` | text | Supabase Storage public URL. |
| `uploaded_at` | timestamptz | Upload time; used by admin report and assignment views. |

### 3.4 `report_votes`

Join model recording one user's vote on one report. The supplied proposal describes one vote per user per issue, and the client calls the `toggle_report_vote` RPC to add/remove a vote and update `reports.votes`.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | References `reports.id`. |
| `user_id` | UUID | References `profiles.id` / `auth.users.id`. |
| `created_at` | timestamptz | Vote time. |

Recommended constraint: unique (`report_id`, `user_id`).

### 3.5 `issue_resolutions`

Detailed field-work record used by the staff dashboard. It stores attendance and completion evidence separately from the report's summary status.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | References `reports.id`; one current resolution record is used by the staff UI. |
| `attendant_name` | text | Staff name recorded at completion. |
| `resolution_note` | text | Staff completion note. |
| `resolution_image_url` | text | URL of the uploaded resolution image. |
| `attended_at` | timestamptz | Attendance/completion time. |
| Additional timestamps | timestamptz | Any `created_at`/`updated_at` audit fields configured in the database. |

## 4. Community models

### 4.1 `community_posts`

Posts published to the citizen community page.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `user_id` | UUID | Author; references `profiles.id`. |
| `category_id` | UUID | Optional reference to `categories.id`. |
| `title` | text | Post title. |
| `content` | text | Post body. |
| `image_url` | text | Optional image URL stored in the `images` bucket. |
| `post_type` | text | Post format, such as text, photo/video, poll, event, or report update. |
| `visibility` | text | Audience visibility setting. |
| `status` | text | Publication state; the feed currently loads `published` posts. |
| `created_at` | timestamptz | Publication/creation time. |
| `updated_at` | timestamptz | Last edit time, if enabled. |

### 4.2 `likes`

Join model for likes on community posts.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `post_id` | UUID | References `community_posts.id`. |
| `user_id` | UUID | References `profiles.id`. |
| `created_at` | timestamptz | Like time. |

Recommended constraint: unique (`post_id`, `user_id`).

### 4.3 `saved_posts`

Join model for a user's saved community posts.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `post_id` | UUID | References `community_posts.id`. |
| `user_id` | UUID | References `profiles.id`. |
| `created_at` | timestamptz | Save time. |

Recommended constraint: unique (`post_id`, `user_id`).

### 4.4 `comments`

Comments attached to community posts.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `post_id` | UUID | References `community_posts.id`. |
| `user_id` | UUID | Comment author; references `profiles.id`. |
| `content` | text | Comment body. |
| `created_at` | timestamptz | Comment time. |
| `updated_at` | timestamptz | Last edit time, if enabled. |

## 5. Services marketplace models

### 5.1 `service_categories`

Reference categories for local service and business listings.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `name` | text | Category name. |
| `slug` | text | URL or stable identifier, shown in the supplied ERD. |
| `description` | text | Category description. |
| `created_at` | timestamptz | Creation time. |

### 5.2 `service_listings`

Marketplace listing created by a business or service provider.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `category_id` | UUID | References `service_categories.id`. |
| `owner_id` | UUID | Optional listing owner; references `profiles.id` / `auth.users.id`. |
| `business_name` | text | Business/provider name. |
| `description` | text | Service description. |
| `location` | text | Business location. |
| `image_url` | text | Listing image URL. |
| `contact_phone` | text | Optional phone number. |
| `contact_email` | text | Optional email address. |
| `rating` | numeric | Aggregate rating, displayed by the marketplace. |
| `reviews_count` | integer | Denormalised number of reviews. |
| `views_count` | integer | Number of listing views. |
| `inquiries_count` | integer | Number of inquiries. |
| `status` | text | Listing state; the citizen marketplace currently displays `active`. |
| `created_at` | timestamptz | Creation time. |
| `updated_at` | timestamptz | Last update time. |

### 5.3 `listing_reviews`

Review and rating submitted for a service listing.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `listing_id` | UUID | References `service_listings.id`. |
| `reviewer_id` | UUID | Reviewer; references `profiles.id` / `auth.users.id`. |
| `rating` | integer or numeric | Review rating. |
| `comment` | text | Review text. |
| `created_at` | timestamptz | Review time. |

### 5.4 `ad_payments`

Payment record for publishing a marketplace listing. The current client uses a mock payment gateway and stores the result as `success`.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `listing_id` | UUID | References `service_listings.id`. |
| `payer_id` | UUID | Optional payer; references `profiles.id` / `auth.users.id`. |
| `amount` | numeric | Listing fee amount. |
| `currency` | text | Currency code, currently `ZAR`. |
| `status` | text | Payment state, such as `success`, `pending`, or `failed`. |
| `payment_reference` | text | Gateway or mock gateway reference. |
| `created_at` | timestamptz | Payment time. |

## 6. Admin workflow models

### 6.1 Assignments

Assignments are currently implemented as attributes on `reports`, rather than as a separate `assignments` table:

- `reports.assigned_to` identifies the staff profile.
- `reports.assigned_to_group_id` identifies an optional staff group.
- `reports.assigned_at` records when the assignment occurred.
- Assignment status is represented by `reports.status`.
- Assignment priority is represented by `reports.severity`.

The admin UI queries `groups (id, name)` through the `reports_assigned_to_group_id_fkey` relationship, which indicates the following supporting model is expected or present.

### 6.2 `groups` (admin support model)

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `name` | text | Team/group name. |
| Membership fields | UUID / timestamps | Membership relation fields, if group membership is enabled. |

The repository does not contain a direct query for group membership, so the complete membership schema cannot be confirmed from source code.

### 6.3 `events`

Scheduled visits or field-work events associated with an assigned report.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key. |
| `report_id` | UUID | References `reports.id`. |
| `event_name` | text | Event/visit name. |
| `description` | text | Event description. |
| `location` | text | Visit location. |
| `event_date` | date or timestamptz | Scheduled event date. |
| `start_date` | timestamptz | Event start. |
| `end_date` | timestamptz | Event end. |
| `status` | text | Event state. |
| `notes` | text | Staff notes. |
| `created_by` | UUID | User who scheduled the event; references `profiles.id` / `auth.users.id`. |
| `created_at` | timestamptz | Creation time. |
| `updated_at` | timestamptz | Last event update. |

## 7. Storage models

Supabase Storage is used instead of a database blob column. Database rows store public URLs or paths.

| Bucket | Used for | Path convention observed |
|---|---|---|
| `images` | Report photos, proof images, community post images, and marketplace listing images. | Report uploads use `<report_id>/<index>-<timestamp>.<ext>`; other features also use generated or feature-specific paths. |
| `Profile` | Profile avatars. | `<user_id>/avatar.<ext>` with upsert enabled. |

## 8. Relationship summary

```text
auth.users 1──1 profiles
profiles 1──* reports
categories 1──* reports
reports 1──* report_images
reports 1──* report_votes *──1 profiles
reports 1──* issue_resolutions
profiles 1──* community_posts
categories 1──* community_posts
community_posts 1──* comments *──1 profiles
community_posts 1──* likes *──1 profiles
community_posts 1──* saved_posts *──1 profiles
service_categories 1──* service_listings
profiles 1──* service_listings
service_listings 1──* listing_reviews *──1 profiles
service_listings 1──* ad_payments *──1 profiles
profiles 1──* reports (assigned_to)
groups 1──* reports (assigned_to_group_id)
reports 1──* events *──1 profiles (created_by)
```

## 9. Derived and application-level models

These values are calculated in React and are not necessarily stored columns:

- **Overdue report**: an open/active report older than seven days.
- **Top-voted report**: the active report with the highest `votes` count; the assignment UI can display it as high severity.
- **Resolution time**: derived from report creation/start and resolution timestamps or resolution records.
- **Resolution rate**: resolved/closed reports divided by reports in the selected analysis period.
- **Overdue rate**: overdue reports divided by reports in the selected analysis period.
- **Category breakdown**: aggregation of reports by `category_id`.
- **Workload**: aggregation of reports by `assigned_to`, `assigned_to_group_id`, status, and category.
- **Listing expiry**: the marketplace client filters listings older than its configured lifetime even when the database status is active.

## 10. Validation and security requirements

The proposal documents the following requirements for the final schema and policies:

- Enforce row-level security for citizen-owned data, staff/admin operations, votes, comments, listings, and payments.
- Restrict staff assignment to profiles with an allowed staff role.
- Enforce one vote per user per report and one like/save per user per post with database uniqueness constraints.
- Validate report descriptions, categories, severity, status, coordinates, and image limits server-side as well as in the client.
- Validate that report coordinates fall within the Tshwane Municipality GeoJSON boundary.
- Keep media access aligned with authenticated ownership and staff permissions.
- Add rate limiting for report submission and other abuse-sensitive operations.
- Audit status, assignment, event, and resolution changes with timestamps and actor identities.

## 11. Known schema gaps

The repository does not include migrations or a generated TypeScript database type file. Consequently, the following should be verified directly in Supabase:

- Exact data types/defaults/check constraints for status, role, severity, and payment fields.
- Whether `groups` and its membership table are fully implemented.
- Whether `issue_resolutions.report_id` is unique.
- Foreign-key delete behavior and indexes, especially for reports, votes, comments, and media.
- Database triggers or RPC behavior that maintains `reports.votes` and marketplace aggregate counters.
- RLS policies, because the proposal and source comments describe them inconsistently and the client currently performs many access checks in application code.
