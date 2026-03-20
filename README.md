# People Rating Flow

A visitor-facing React app for rating a fixed roster of people across multiple categories. The roster is owned outside the UI, visitors only submit scores, and final conclusions stay hidden until every person has been fully rated.

## Features

- Fixed roster loaded through a dedicated people service
- Default categories: Communication, Reliability, Leadership, Teamwork, Creativity
- Sequential rating flow for visitors
- Required rater name before the scoring flow begins
- 1 to 5 scoring per category for every person
- Per-person comments saved alongside ratings
- Conclusions locked until the full roster is completed
- Tie-aware ranking display
- Summary cards for best overall, best by category, category averages, and number of people
- Final ranking table revealed after completion
- Shared reveal history and activity logs via Supabase when configured
- Local draft persistence with `localStorage`
- Activity log for rating changes, comments, reveals, resets, and exports
- HTML report export with raw data attached
- Reset current rating session
- Responsive dashboard layout

## Tech Stack

- React 19
- Vite
- Plain CSS with a small component-based structure
- `lucide-react` for icons

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open the local Vite URL shown in the terminal.

### Production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Backend Setup

### Shared Results With Supabase

The app now supports a shared cross-device results system through Supabase.

1. Create a Supabase project.
2. Run the SQL in [supabase/schema.sql](/Users/warotkomontree/Documents/Playground/supabase/schema.sql).
3. Copy [`.env.example`](/Users/warotkomontree/Documents/Playground/.env.example) to `.env`.
4. Fill in:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

5. Restart the Vite dev server or rebuild the app.

When these env vars are present:

- revealed results are saved to Supabase
- activity logs are saved to Supabase
- the in-app system history reads the shared records, so ratings done on other computers become visible here

When these env vars are missing, the app falls back to local-only browser storage.

The app currently reads the roster from [src/services/peopleService.js](/Users/warotkomontree/Documents/Playground/src/services/peopleService.js), which wraps a local public roster file at [src/data/peopleRoster.js](/Users/warotkomontree/Documents/Playground/src/data/peopleRoster.js).

To connect your own backend, replace the implementation of `fetchPeopleRoster()` with your API call and keep the returned shape:

```js
{
  id: "unique-id",
  name: "Person Name",
  role: "Optional role",
  summary: "Optional short context"
}
```

The frontend treats the roster as read-only and does not expose add/edit/delete controls to visitors. Any truly private owner-only notes must stay on a backend and must not be shipped to the browser bundle.

## Usage Notes

- Every visitor must rate every person in every category before conclusions appear.
- Overall score is calculated from rated categories only.
- Scores are shown with 2 decimal places.
- Draft ratings and comments stay in `localStorage` for the current browser.
- Shared saved results and logs require Supabase configuration.
- Reset clears the visitor's saved session.

## Project Structure

```text
src/
  components/
  data/
  services/
  utils/
```

The roster service, scoring logic, and session persistence are separated from the UI so the roster source can be swapped from local data to a real backend cleanly.
