# API-Token Version of the Extractor (separate copy)

Goal: keep this cookie-based project exactly as it is, and build a second version that talks to Moodle through your web service token (`wstoken`) instead of a browser session cookie.

## Where the new version lives

Lovable can't create a brand-new project from chat, so pick one:

1. **Recommended — Duplicate the project**: in the Lovable editor use the project menu → Remix/Duplicate, open the copy, and tell me "build the API version here". This project stays untouched.
2. **Draft branch**: I create a draft of this project (own branch + chat) and build API mode there. Nothing lands on main until you accept it.

Everything below is what gets built in that copy.

## What changes in the copy

- Step 1 of the wizard becomes **Moodle URL + Web Service Token** (password field, show/hide) instead of a session cookie. Validation calls `core_webservice_get_site_info` and shows the logged-in user's full name and site name.
- Course ID field stays, but activity discovery uses `core_course_get_contents`, which returns every VPL and Quiz with its real name and instance id in one call — no HTML parsing, much faster.
- Step 2 gets a new option: **Load enrolled students from Moodle** via `core_enrol_get_enrolled_users`, so you no longer have to paste rosters. Manual paste / CSV / Excel upload stays as a fallback, and roll numbers are still parsed from names/idnumber.
- Quiz data comes from `mod_quiz_get_user_attempts` per student (attempt number, start/finish time, state, score) plus the quiz's max grade — no scraping of the report tab.
- Marks for both VPL and Quiz are read from `gradereport_user_get_grade_items`, one call per course, giving the graded value for every student and activity at once. That is what fills the Master Summary and the Grade column.
- The Excel output keeps the exact same sheets, colours, fonts and column layout as today (Attempts, Summary, Quiz Results, Master Summary, Attempt Marks Grid, Unmatched Students).

## The VPL limitation, stated plainly

Moodle's web service API has no functions for VPL submissions — `mod_vpl` ships no external API. With a token alone you can get, per student and per VPL: the final gradebook mark, feedback and grade timestamp. You cannot get the per-attempt rows (attempt #, submission timestamp per attempt, submission view URL).

So in the API copy:

- **VPL Summary and Master Summary**: fully populated from the gradebook.
- **VPL Attempts sheet**: one row per student with the final grade, and a note that per-attempt history needs a session cookie.
- Optional extra: a "cookie boost" field in Step 1 — if you also paste a MoodleSession cookie, the copy reuses the existing scraper to fill full per-attempt history. Token-only still works; the cookie just adds attempt detail.

## Technical notes

- New `src/lib/moodle-api.server.ts` wrapping `POST {url}/webservice/rest/server.php` with `wstoken`, `moodlewsrestformat=json`, and Moodle's `exception`/`errorcode` envelope mapped to human-readable messages (invalid token, missing capability, function not enabled).
- New `src/lib/moodle-api.functions.ts` server functions: `validateToken`, `discoverActivitiesApi`, `listEnrolledStudents`, `fetchGradeItems`, `fetchQuizAttemptsApi`. Token is passed from the client to the server function and never logged or persisted server-side, same as the cookie today.
- Existing `moodle.server.ts` / `moodle.functions.ts` stay in place, used only when a cookie is supplied.
- `useExtraction` gains an `auth: "token" | "cookie"` mode that picks the fetch path; job store, fuzzy matching, live dashboard, faculty views and `excel.ts` are unchanged.
- Required web service functions must be enabled on the token's service in Moodle: `core_webservice_get_site_info`, `core_course_get_contents`, `core_enrol_get_enrolled_users`, `gradereport_user_get_grade_items`, `mod_quiz_get_quizzes_by_courses`, `mod_quiz_get_user_attempts`. If one is missing, the app names it in the error.

## Order of work in the copy

1. API client + token validation, verified against your live site.
2. Course contents discovery and enrolled-student loading.
3. Grade items → Master Summary and VPL Summary.
4. Quiz attempts.
5. Optional cookie boost for VPL attempt history.
