# Society & Event Fund Management System — Backend

REST API powering a full-stack MERN application for managing societies, events, memberships, dues, and payments.

**Live App:** [fund-management-front-end.vercel.app](https://fund-management-front-end.vercel.app/)
**Frontend Repo:** *(link your frontend repo here)*

---

## What This API Does

Handles all backend logic for a coordination problem: tracking who owes what, to whom, for which event or society — supporting both registered users and offline/guest participants, invitation-based and self-service join flows, automated payment reminders, and a full audit trail of every payment and correction.

---

## Tech Stack

- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — data layer
- **JWT** — authentication (`authMiddleware` attaches `req.user.id`)
- **Cloudinary + Multer** — image uploads (event covers, society logos, payment receipts)
- **node-cron** — daily scheduled payment reminders
- **Nodemailer** — invitation emails to non-registered users
- **Google Gemini API** — AI-generated event categories/descriptions

---

## Core Concepts

### Societies vs. Events
A **Society** is a persistent community (e.g. a housing society, club). An **Event** can either:
- belong to a society (`event.society` is set) — membership flows through the society, or
- stand alone as a **personal event** (`event.society: null`) — has its own independent membership

This distinction matters throughout the API: the Discover endpoints only surface standalone events, since society-attached events are joined by joining the society itself.

### Membership is never embedded
Neither `Society` nor `Event` stores an embedded array of member objects as the source of truth. Instead:
- `SocietyMember` and `EventMember` are separate collections — the single source of truth for who belongs where
- `Event.members` holds an array of `EventMember` ObjectIds (populated on read), but the actual member data — role, dues, payment status — lives in `EventMember`

### Three ways to join something
1. **Admin invites a user** (`Invitation` model) — admin-initiated, invitee accepts/rejects
2. **Admin adds someone directly** — no email (offline member) or email with no account (online guest) — added immediately, no acceptance needed
3. **User requests to join** (`JoinRequest` model) — user-initiated, admin approves/rejects, requester can cancel

These are separate models because the initiating party and semantics differ — an `Invitation` waits on the invitee, a `JoinRequest` waits on the admin.

### Payment audit trail
Every real payment and every manual correction (e.g. an admin editing `amountPaid` directly) is logged as a `Payment` document. Corrections can be positive or negative deltas, so:

```
sum(Payment.amount for a member) === member.amountPaid
```

always holds — this invariant makes payment history fully reconstructable and auditable rather than trusting a single mutable field.

---

## Data Models

| Model | Purpose |
|---|---|
| `User` | Auth and identity |
| `Society` | A community; no embedded members |
| `SocietyMember` | Membership + dues tracking for a society (supports offline/guest members via nullable `user`) |
| `Event` | A personal or society-linked event; AI-generated category via Gemini |
| `EventMember` | Membership + dues tracking for an event; partial unique indexes on `{event, user}` and `{event, email}` prevent duplicates without blocking guests |
| `Invitation` | Admin-initiated invite, tracked by status (`pending/accepted/rejected/cancelled`) |
| `JoinRequest` | User-initiated request to join, tracked by status (`pending/approved/rejected/cancelled`) |
| `Payment` | Append-only ledger of real payments and corrections, generalized across events and societies via `targetType` |
| `Notification` | In-app notifications for invites, join requests, payments, and event updates |

---

## API Overview

| Route prefix | Handles |
|---|---|
| `/api/auth` | Login, signup, session |
| `/api/users` | User profile |
| `/api/societies` | Society CRUD, membership, `discover`, join requests |
| `/api/events` | Event CRUD, participants, members, payments, `discover`, join requests |
| `/api/invitations` | Send/accept/reject/cancel invitations |
| `/api/join-requests` | Approve/reject/cancel self-initiated join requests |
| `/api/notification` | Fetch, mark read, mark all read |
| `/api/spends` | Event expense tracking |
| `/api/ai` | AI-assisted description suggestions |

> Note: `/discover` and other literal routes are always registered **before** any `/:id`-style catch-all route in the same router, to avoid Express matching them as a param value.

---

## Key Features

- **Dual add-member pattern** — admins can invite (needs acceptance) or add directly (offline/guest)
- **Discover + Join Request flow** — users can browse societies/standalone events they're not part of, request to join, cancel a pending request, and admins approve/reject from their notification feed
- **Permission model** — a society admin can manage any event under their society without being separately added as that event's admin (`isEventOrSocietyAdmin`)
- **Automated payment reminders** — daily cron job notifies members with upcoming or overdue dues, with a cooldown to avoid duplicate spam
- **Admin overview aggregation** — every society/event a user administers, with full due-date breakdowns (overdue / due soon / upcoming)
- **Idempotent migration scripts** — backfill dues fields and reconstruct historical "Opening balance" payments on pre-existing data

---

## Notable Engineering Decisions & Bugs Fixed

- **`req.user.uid` vs `req.user.id`** — JWT auth middleware sets `.id`; a separate Firebase auth middleware sets `.uid`. Looking up the wrong one silently 404'd every request.
- **Mongoose `pre("validate")` hooks must pick one style** — mixing `async` with a callback-style `next()` throws `next is not a function`, since Mongoose treats async pre-hooks as promise-based and never passes `next`. Fixed by using conditional `required` field validators instead of a hook.
- **Route ordering with Express params** — a catch-all like `router.get("/:societyId", ...)` swallows a literal route like `/discover` if declared afterward.
- **Partial unique indexes** — `EventMember`'s `{event, user}` and `{event, email}` indexes are scoped with `partialFilterExpression` so they only apply when that field is actually set, allowing both registered users and guests without collisions.
- **Silent field-dropping in shared helpers** — a shared `createNotification()` helper only forwarded a fixed set of destructured fields; adding a new field to a caller without updating the helper's signature meant it was silently discarded on save.

---

## Project Structure

```
Fund-management-Back-end/
├── models/
│   ├── Event/           (Event, EventMember, Payment, Spend)
│   ├── Society/          (Society, SocietyMember)
│   ├── Invitation/
│   ├── JoinRequest/
│   ├── Notification/
│   └── User.js
├── controllers/
├── routes/
├── middleware/            (auth, upload)
├── services/              (Gemini AI, payment reminder cron)
├── scripts/migrations/    (idempotent backfill scripts)
└── server.js
```

---

## Running Locally

```bash
git clone <this-repo>
cd Fund-management-Back-end
npm install
```

Create a `.env` file:
```
MONGO_URI=
JWT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
EMAIL_USER=
EMAIL_PASS=
GEMINI_API_KEY=
FRONTEND_URL=
PORT=3000
```

```bash
npm run dev
```

Server starts on `http://localhost:3000`, connects to MongoDB, and starts the daily payment reminder cron job.

---

## Author

Built by Abhijeet Goril.