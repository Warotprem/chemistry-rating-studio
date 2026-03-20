# People Rating Flow

A visitor-facing React app for rating a fixed roster of people across multiple categories. The roster is owned outside the UI, visitors only submit scores, and final conclusions stay hidden until every person has been fully rated.

## Features

- Fixed roster loaded through a dedicated people service
- Default categories: Communication, Reliability, Leadership, Teamwork, Creativity
- Sequential rating flow for visitors
- 1 to 5 scoring per category for every person
- Conclusions locked until the full roster is completed
- Tie-aware ranking display
- Summary cards for best overall, best by category, category averages, and number of people
- Final ranking table revealed after completion
- Persistent visitor progress with `localStorage`
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

The app currently reads the roster from [src/services/peopleService.js](/Users/warotkomontree/Documents/Playground/src/services/peopleService.js), which wraps a local file at [src/data/peopleRoster.js](/Users/warotkomontree/Documents/Playground/src/data/peopleRoster.js).

To connect your own backend, replace the implementation of `fetchPeopleRoster()` with your API call and keep the returned shape:

```js
{
  id: "unique-id",
  name: "Person Name",
  role: "Optional role",
  summary: "Optional short context",
  privateNotes: "Hidden owner-only comments used for coach-style conclusions"
}
```

The frontend treats the roster as read-only, does not expose add/edit/delete controls to visitors, and never renders `privateNotes` directly. Those notes are only used to generate internal comparison insights in the conclusions view.

## Usage Notes

- Every visitor must rate every person in every category before conclusions appear.
- Overall score is calculated from rated categories only.
- Scores are shown with 2 decimal places.
- Progress is saved in `localStorage` for the current browser.
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
