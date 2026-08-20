# Moodle Report Pro

You are a senior full-stack developer. Build a complete web application 
called "REVA VPL & Quiz Report Extractor" with a Python FastAPI backend 
and a modern React frontend.

═══════════════════════════════════════════════════════════════
OVERVIEW
═══════════════════════════════════════════════════════════════
The app automates extraction of student submission data from a 
Moodle LMS (https://rulms.reva.edu.in) for VPL (Virtual Programming Lab) 
and Quiz activities, then exports everything to a styled Excel report.

═══════════════════════════════════════════════════════════════
BACKEND — FastAPI (Python)
═══════════════════════════════════════════════════════════════

Tech Stack:
- FastAPI + Uvicorn
- BeautifulSoup4 + Requests (web scraping)
- OpenPyXL (Excel generation)
- python-dotenv (secrets)
- Pydantic (request validation)
- Background Tasks (async job processing)

API Endpoints:

POST /api/extract
  Request body:
  {
    "moodle_url": "https://rulms.reva.edu.in",
    "session_cookie": "abc123...",
    "course_id": "565",                    // optional - auto-discovers activities
    "section_name": "CSE-A",              // e.g. CSE-A, CSE-B, CSE-C, CSE-D, CSE-E
    "extraction_mode": 1,                  // 1=filtered students, 2=all students
    "vpl_activity_ids": ["24261","24262"], // optional - manual list
    "quiz_activity_ids": ["12345","12346"],// optional - quiz activity IDs
    "students": [                          // optional - for mode 1
      {"roll_no": "R25EF001", "name": "STUDENT NAME"}
    ],
    "output_filename": "CSE_A_Report"
  }
  Response:
  {
    "job_id": "uuid",
    "status": "started",
    "message": "Extraction started for CSE-A"
  }

GET /api/status/{job_id}
  Response:
  {
    "job_id": "uuid",
    "status": "running|completed|failed",
    "progress": {
      "current_activity": 3,
      "total_activities": 17,
      "current_student": 25,
      "total_students": 52,
      "activity_name": "Maximum value in array",
      "percent": 45,
      "log": ["[10:23] Lab 1 done - 52 students", "..."]
    }
  }

GET /api/download/{job_id}
  Returns the generated Excel file as download

POST /api/validate-cookie
  Request: { "moodle_url": "...", "session_cookie": "..." }
  Response: { "valid": true, "username": "teacher@reva.edu.in" }

POST /api/discover-activities
  Request: { "moodle_url": "...", "session_cookie": "...", "course_id": "..." }
  Response: {
    "vpl_activities": [{"id":"24261","name":"Maximum value in array"}],
    "quiz_activities": [{"id":"12345","name":"Quiz 1 - Arrays"}]
  }

GET /api/jobs
  Returns list of all past extraction jobs with status and download links

DELETE /api/jobs/{job_id}
  Deletes a job and its associated file

Background Job Logic (reuse existing scraping script):
- Validate session cookie first
- Auto-discover VPL + Quiz activity names
- Loop through each activity:
    For VPL: scrape submissionslist → previoussubmissionslist → submissionview (grade)
    For Quiz: scrape quiz attempt data per student
- Match students by name fuzzy matching (5-level scoring)
- Resume from checkpoint if job is interrupted
- Save progress to job store every 20 students
- Generate Excel with sheets:
    Per lab: "{Lab} - Attempts" + "{Lab} - Summary"
    Per quiz: "{Quiz} - Results"
    Master Summary (students × all activities marks grid)
    Attempt Marks Grid
    Unmatched Students

Excel Format:
- VPL Attempts columns: Roll No | Student Name | User ID | Class Section | 
  Attempt # | Submission Date & Time | Description | Grade | Status | 
  Submission View URL | Submission ID
- VPL Summary columns: Roll No | Student Name | User ID | Class Section | 
  Attempt Count | Attempt Numbers | Attempt Marks | Submission Dates & Times | 
  Marks | Latest Submission | Description
- Quiz Results columns: Roll No | Student Name | User ID | Class Section | 
  Quiz Attempt # | Start Time | Finish Time | Score | Grade | State
- Master Summary: Roll No | Student Name | User ID | Class Section | 
  [Lab1] | [Lab2]... | [Quiz1] | [Quiz2]... | Total Marks | Completed

═══════════════════════════════════════════════════════════════
FRONTEND — React + TailwindCSS
═══════════════════════════════════════════════════════════════

Pages:

1. HOME / DASHBOARD
   - Header: "REVA VPL & Quiz Report Extractor"
   - Stats cards: Total Jobs | Active Jobs | Reports Generated | Students Processed
   - Recent jobs table with status badges and download buttons
   - Quick Start button

2. NEW EXTRACTION PAGE
   Step-by-step wizard with 4 steps:

   STEP 1 — Moodle Connection
   - Moodle URL input (prefilled: https://rulms.reva.edu.in)
   - MoodleSession Cookie input (password type, with show/hide toggle)
   - "How to get cookie" collapsible help section with screenshots guide
   - Validate Cookie button → shows green tick + username or red error
   - Course ID input (optional) with "Auto-discover Activities" button

   STEP 2 — Section & Students
   - Section Name input (e.g. CSE-A, CSE-B, CSE-C, CSE-D, CSE-E)
   - Extraction Mode toggle:
       Mode 1: Specific students (show student list input)
       Mode 2: All enrolled students
   - Student list input (paste Roll No TAB Name per line)
     OR upload CSV/Excel file with Roll No + Name columns
   - Student count badge updates live as you type
   - Preset section buttons: [CSE-A] [CSE-B] [CSE-C] [CSE-D] [CSE-E]
     (clicking loads saved student list for that section)

   STEP 3 — Activities
   - Two tabs: VPL Activities | Quiz Activities
   - Each tab has:
       Auto-discovered list (checkboxes to select/deselect)
       Manual input: paste activity URLs or IDs (one per line)
       "Fetch Names" button to auto-fetch activity names
   - Activity cards showing: ID | Name | Type (VPL/Quiz) | checkbox
   - Select All / Deselect All buttons
   - Drag to reorder activities (affects sheet order in Excel)

   STEP 4 — Output Settings
   - Output filename input
   - Preview of sheet names that will be generated
   - Estimated time display based on students × activities
   - Start Extraction button (big, prominent)

3. EXTRACTION PROGRESS PAGE
   - Job ID displayed
   - Large circular progress ring (0-100%)
   - Current activity name + student name
   - Two progress bars: Activities (3/17) | Students (25/52)
   - Live log feed (scrollable, auto-scroll to bottom)
   - Status badges: Completed | Running | Failed | Queued
   - Cancel button
   - When complete: Download Excel button (prominent, green)
   - Error display with retry button

4. JOBS HISTORY PAGE
   - Table: Job ID | Section | Date | Activities | Students | Status | Actions
   - Actions: Download | View Log | Delete
   - Filter by status, section, date range
   - Bulk delete option

5. COOKIE HELPER PAGE
   - Step-by-step visual guide with annotated screenshots
   - Browser-specific instructions (Chrome / Firefox / Edge)
   - Copy cookie button that opens a modal to paste and validate

═══════════════════════════════════════════════════════════════
DESIGN SYSTEM
═══════════════════════════════════════════════════════════════
- Color scheme: Dark navy (#1F3864) + Medium blue (#2B5592) + 
  Light blue accents + Green for success + Orange for warnings
- Font: Inter or Calibri-style
- Cards with subtle shadows
- Status badges: 
    Running = blue pulse animation
    Completed = solid green
    Failed = solid red  
    Queued = yellow
- Toast notifications for success/error
- Skeleton loading states
- Mobile responsive

═══════════════════════════════════════════════════════════════
PROJECT STRUCTURE
═══════════════════════════════════════════════════════════════

backend/
├── main.py              # FastAPI app + all routes
├── scraper.py           # All scraping logic (reuse existing script)
├── excel_builder.py     # Excel generation logic
├── job_store.py         # In-memory + file-based job tracking
├── models.py            # Pydantic request/response models
├── config.py            # Settings + env vars
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── NewExtraction.jsx
│   │   ├── Progress.jsx
│   │   ├── JobHistory.jsx
│   │   └── CookieHelper.jsx
│   ├── components/
│   │   ├── StepWizard.jsx
│   │   ├── ActivitySelector.jsx
│   │   ├── StudentListInput.jsx
│   │   ├── ProgressRing.jsx
│   │   ├── LogFeed.jsx
│   │   ├── JobCard.jsx
│   │   └── CookieInput.jsx
│   ├── hooks/
│   │   ├── useJobPolling.js    # polls /api/status every 2s
│   │   └── useExtraction.js
│   └── App.jsx
└── package.json

═══════════════════════════════════════════════════════════════
SPECIFIC BEHAVIORS
═══════════════════════════════════════════════════════════════

1. Cookie validation runs immediately on blur of cookie input field
2. Activity discovery triggers automatically when Course ID is entered
3. Job polling uses WebSocket or SSE if available, falls back to polling
4. Progress page auto-redirects from New Extraction on job start
5. Download button appears immediately when job completes
6. If job fails mid-way, show which activity failed and offer resume
7. Student list supports:
   - Manual paste (Roll No [TAB or comma] Name, one per line)
   - CSV upload (Roll No, Name columns)
   - Excel upload (.xlsx)
8. Save section presets to localStorage so they persist across sessions
9. Excel download uses Content-Disposition header with proper filename
10. All API errors show human-readable messages (not stack traces)

═══════════════════════════════════════════════════════════════
SECURITY
═══════════════════════════════════════════════════════════════
- Session cookies never logged or stored permanently
- Jobs auto-deleted after 24 hours
- Rate limiting on /api/extract (max 3 concurrent jobs)
- CORS configured for frontend origin only
- No student data stored beyond the Excel file lifetime
- .env for all secrets

═══════════════════════════════════════════════════════════════
START WITH
═══════════════════════════════════════════════════════════════
1. FastAPI backend with all 6 endpoints working
2. Job store with background task execution
3. React frontend with the 4-step wizard fully functional
4. Progress polling working end-to-end
5. Excel download working
6. Then add: job history, cookie helper, presets

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/21566b03-04e7-4942-9755-7b8b0ebcdd61).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
