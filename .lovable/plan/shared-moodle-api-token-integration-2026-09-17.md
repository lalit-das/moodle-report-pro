# Shared Moodle API Token Integration

## Goal
Use one institution-wide Moodle API token securely in the app so faculty members never need the token or a MoodleSession cookie. Their first input will be the Moodle course link, followed by the existing section, student, activity, and output choices.

## User flow
1. Faculty opens **New extraction**.
2. They paste a Moodle course link such as `https://rulms.reva.edu.in/course/view.php?id=565`.
3. The app checks access and automatically discovers that course’s VPL and quiz activities.
4. Faculty chooses their section, student mode/list, activities, and output filename as before.
5. Extraction, progress, live scores, job history, and Excel download continue using the existing screens.

## Implementation
- Enable Lovable Cloud so the Moodle token is stored as a protected server secret, never in the browser, page source, job history, logs, or downloaded report.
- Add a Moodle REST client that:
  - accepts only the configured REVA Moodle host;
  - extracts and validates the course ID from the pasted course link;
  - validates the saved token with Moodle;
  - discovers course modules and separates VPL and quiz activities;
  - loads enrolled students and available grades/attempt data;
  - converts API responses into the app’s existing VPL, quiz, progress, and Excel data shapes.
- Update all Moodle server functions to read the saved token internally instead of accepting a token or cookie from faculty browsers.
- Simplify the first wizard step to **Course link** plus an access check. Keep the remaining three steps and existing report format unchanged.
- Update activity-name lookup, extraction start, retry/resume, progress messages, and errors so none request a fresh cookie.
- Retain the current cookie implementation only as an administrator fallback during rollout; it will not appear in the normal faculty workflow.

## Moodle capability check
Before switching the normal workflow, test the real token against the course-content, enrolled-user, grade-report, quiz-attempt, and VPL web-service functions enabled by REVA Moodle.

Standard Moodle APIs cover course discovery, enrolled users, and grade items. Full VPL submission history and full quiz attempt reports depend on which web-service functions the REVA Moodle administrator enabled. If a required function is unavailable, the app will identify that exact permission/function instead of generating an incomplete report; the cookie-based administrator fallback will remain usable until Moodle enables it.

## Security
- The token is submitted once through Lovable’s secure secret form and used only by server functions.
- Faculty never receive or enter the token.
- Requests are restricted to the configured REVA Moodle URL; arbitrary Moodle URLs are rejected.
- Moodle error responses and logs are sanitized so the token cannot be exposed.
- This plan does not add faculty sign-in or permission-based dashboard access. The app should not be published publicly with an institution-wide token until access control is added.

## Verification
- Confirm a valid course link discovers the expected VPL and quiz activities.
- Confirm an invalid/non-REVA link is rejected clearly.
- Compare VPL students, all attempts, numeric grades, quiz results, and activity names with Moodle’s own pages and the reference Python output.
- Generate an Excel file and verify its existing sheets, formatting, numeric Grade column, and absence of the removed Lab Marks column.
- Verify faculty can complete the full flow without seeing or entering a token or cookie.
- Verify the token never appears in browser requests, saved jobs, logs, or report files.
