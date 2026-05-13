# LearnLanka — User Story Set v0.1

---

## Story 1: Search for a tutor by subject and language

**As a** Student
**I want** to search for tutors by subject, grade level, and teaching language
**So that** I can find a tutor who matches my specific learning needs without contacting each one separately

### Acceptance Criteria

- **Given** a logged-in Student on the search screen **when** they enter a subject name and select a grade level and language filter and tap Search **then** the results page loads within 800 ms and shows only tutors matching all selected filters
- **Given** a logged-in Student on the search screen **when** no tutors match the selected filters **then** the platform displays a clear message stating no results were found and suggests broadening the filters
- **Given** a logged-in Student viewing search results **when** the results load **then** each tutor card shows the tutor name, subjects, teaching language, hourly rate, and average star rating

### INVEST self-check
- [x] Independent — does not depend on any other story
- [x] Negotiable — filter combinations can be adjusted based on feedback
- [x] Valuable — directly solves the core discovery problem for students
- [x] Estimable — team can size this as a standard search + filter feature
- [x] Small — scoped to search and results display only, not booking
- [x] Testable — acceptance criteria are observable and measurable

---

## Story 2: Book a one-hour session with a tutor

**As a** Student
**I want** to select an available time slot from a tutor's profile and submit a booking request
**So that** I can reserve a confirmed session at a time that suits me

### Acceptance Criteria

- **Given** a logged-in Student viewing a tutor profile **when** they select an available 1-hour slot and tap Book **then** a booking request is sent to the tutor and the slot is locked from other students for the duration of the request
- **Given** a Student who has submitted a booking request **when** the tutor accepts **then** the Student is prompted immediately to complete payment through PayHere
- **Given** a Student who has submitted a booking request **when** the tutor declines **then** the Student receives a notification, the slot is released, and no charge is made
- **Given** a Student who was prompted to pay **when** payment is not completed within 15 minutes **then** the booking is automatically cancelled and the slot is released back to availability

### INVEST self-check
- [x] Independent — search story is separate; this covers booking flow only
- [x] Negotiable — the 15-minute timeout window is an assumption open to discussion
- [x] Valuable — booking is the core transaction of the platform
- [x] Estimable — two-step flow (request then payment) is well understood
- [x] Small — scoped to request and payment trigger; session joining is a separate story
- [x] Testable — each acceptance criterion has an observable outcome

---

## Story 3: Pay for a session using card or eZ Cash

**As a** Student
**I want** to pay for a confirmed booking using my card or eZ Cash through PayHere
**So that** my session is secured and I do not have to handle payment outside the platform

### Acceptance Criteria

- **Given** a Student who has been prompted to pay after tutor acceptance **when** they complete card payment via PayHere **then** the booking status changes to Confirmed and the Student receives a booking confirmation notification
- **Given** a Student completing payment **when** the transaction is processed **then** no card number, CVV, or raw payment credential is stored on LearnLanka servers
- **Given** a Student whose payment fails **when** the failure is returned by PayHere **then** the Student sees a clear error message and is given the option to retry within the 15-minute window

### INVEST self-check
- [x] Independent — separate from booking request story
- [x] Negotiable — retry behaviour and error messages are negotiable
- [x] Valuable — payment completion is what converts a request into a confirmed session
- [x] Estimable — PayHere integration is a defined scope item
- [x] Small — scoped to payment step only
- [x] Testable — confirmation status and zero data storage are both verifiable

---

## Story 4: Manage availability and respond to booking requests

**As a** Tutor
**I want** to publish my available time slots and accept or decline incoming booking requests
**So that** I only teach at times I have chosen and stay in full control of my schedule

### Acceptance Criteria

- **Given** a logged-in Tutor on their availability screen **when** they add a new 1-hour time slot **then** the slot becomes visible to Students on the tutor's profile immediately
- **Given** a Tutor who has an incoming booking request **when** they view the request **then** they can see the Student name, requested subject, and time slot, and can tap Accept or Decline
- **Given** a Tutor who taps Accept on a booking request **then** the Student is notified and prompted to pay, and the slot is no longer available for other students
- **Given** a Tutor who wants to cancel a confirmed booking **when** the session start time is less than 12 hours away **then** the platform blocks the cancellation and displays an explanation

### INVEST self-check
- [x] Independent — does not depend on student-side stories
- [x] Negotiable — slot duration and cancellation window are open to discussion
- [x] Valuable — without this story tutors cannot participate in the platform
- [x] Estimable — calendar management and request handling are standard patterns
- [x] Small — covers availability and request response only; payouts are separate
- [x] Testable — all four criteria produce observable system states

---

## Story 5: Receive weekly payout for completed sessions

**As a** Tutor
**I want** to receive automatic weekly bank transfers for all sessions I have completed
**So that** I do not have to chase payments manually and can trust the platform to pay me on time

### Acceptance Criteria

- **Given** a Tutor who has completed one or more sessions in a Monday–Sunday week **when** the payout is processed **then** the transfer amount equals the total session fees collected minus 15% commission for each session
- **Given** a Tutor viewing their payout summary **when** they open the weekly breakdown **then** they can see each completed session, the gross fee, the 15% commission deducted, and the net amount paid
- **Given** a Tutor who has not added bank account details **when** a payout is due **then** the platform notifies them to add bank details before the transfer can be initiated

### INVEST self-check
- [x] Independent — separate from session joining and booking stories
- [x] Negotiable — the Monday–Sunday cycle and 7-day initiation window are assumptions open to review
- [x] Valuable — timely payment is a key trust factor for tutors
- [x] Estimable — Sampath Vishwa integration and commission calculation are scoped
- [ ] Small — touches payout calculation, bank detail management, and Sampath Vishwa integration; may need to be split. Note: keeping together for MVP scoping clarity.
- [x] Testable — payout amounts and breakdown are verifiable against session records

---

## Story 6: Approve a tutor account before it goes live

**As an** Operations Admin
**I want** to review and approve or reject tutor registration applications
**So that** only verified and suitable tutors appear in student search results

### Acceptance Criteria

- **Given** a new tutor has submitted a registration **when** the Operations Admin opens the pending applications list **then** they can see the tutor name, subjects, grade levels, languages, session price, and submitted ID details
- **Given** an Operations Admin reviewing a tutor application **when** they tap Approve **then** the tutor profile becomes visible in student search results and the tutor receives an approval notification
- **Given** an Operations Admin reviewing a tutor application **when** they tap Reject and enter a reason **then** the tutor is notified with the rejection reason and their profile remains hidden from students
- **Given** a tutor whose account has not yet been reviewed **when** a student searches for tutors **then** that tutor's profile does not appear in any search results

### INVEST self-check
- [x] Independent — stands alone as an admin workflow story
- [x] Negotiable — the fields required for verification can change
- [x] Valuable — tutor quality control protects the platform's reputation
- [x] Estimable — admin review UI and status flag are straightforward to size
- [x] Small — scoped to approval/rejection only; complaint handling is a separate story
- [x] Testable — visibility in search results is a clear observable outcome

---

## Story 7: Rate a tutor after a completed session

**As a** Student
**I want** to give a 1–5 star rating and a one-line comment after my session ends
**So that** future students can make informed choices and tutors are motivated to deliver good sessions

### Acceptance Criteria

- **Given** a session that has been automatically marked as completed by the platform **when** the Student opens their session history **then** a Rate this session prompt appears for that session
- **Given** a Student on the rating screen **when** they select a star rating between 1 and 5 and submit **then** the rating is saved and the tutor's average rating is updated immediately
- **Given** a Student who has not yet completed any session **when** they view any tutor profile **then** no rating option is shown and they cannot submit a rating for a session that has not happened

### INVEST self-check
- [x] Independent — separate from booking and payment stories
- [x] Negotiable — one-line comment length limit is open to discussion
- [x] Valuable — ratings build trust and are a key differentiator for the platform
- [x] Estimable — simple form submission with average calculation
- [x] Small — tightly scoped to post-session rating only
- [x] Testable — rating submission and average update are both verifiable

---

## Story 8: Search results must load within 800 ms (non-functional story)

**As a** Student on a Sri Lankan mobile network
**I want** tutor search results to appear within 800 milliseconds
**So that** I do not abandon the platform due to slow loading on mobile data

### Acceptance Criteria

- **Given** a logged-in Student on the search screen with filters applied **when** they tap Search **then** the first page of results loads within 800 ms at the 95th percentile as measured from a Sri Lankan ISP
- **Given** the search API under normal load **when** response time is monitored via Azure Application Insights **then** the p95 response time stays below 800 ms across all time windows
- **Given** search results that exceed the 800 ms threshold at p95 **when** detected by monitoring **then** an alert is raised for the engineering team to investigate

### INVEST self-check
- [x] Independent — purely a performance constraint on the search feature
- [x] Negotiable — 800 ms threshold comes from the brief but can be reviewed
- [x] Valuable — directly affects whether students stay on the platform
- [x] Estimable — can be sized as a performance optimisation and monitoring task
- [x] Small — scoped to one endpoint and one metric
- [x] Testable — p95 latency from a Sri Lankan ISP is a measurable, observable target

