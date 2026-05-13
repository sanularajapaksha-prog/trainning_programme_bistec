# LearnLanka — Requirements Document

*Sanula | Day 1 | Intern Onboarding*

---

## 1. Problem Statement

Many O/L and A/L students across Sri Lanka struggle to find trustworthy, affordable tutors because tutor availability, pricing, language of instruction, and verified credentials are scattered across informal channels such as Facebook groups and word-of-mouth referrals. Students have no reliable way to compare tutors, check ratings from previous students, or book and pay for a session in one place. At the same time, qualified tutors who want to earn income from online teaching have no structured platform to advertise their availability, manage bookings, or receive timely payment. LearnLanka addresses both sides of this problem by providing a mobile-first marketplace where students can search for vetted tutors by subject, grade, language, and price, book a confirmed one-hour online session, pay securely through PayHere, attend the session via an integrated video provider, and leave a rating after the class — while tutors can manage their schedule, receive bookings, conduct sessions, and be paid automatically each week.

---

## 2. Personas

### Persona 1 — Student

**Kavindu Perera, Age 17, Colombo**

A/L student in the Physical Science stream. Studies mainly on his Android phone and needs extra help for Combined Mathematics and Physics. Relies on mobile data and expects the platform to be fast and simple.

**Goals:**
- Find a verified tutor for a specific subject, grade level, and teaching language.
- Compare tutor ratings and hourly prices before committing to a booking.
- Book a one-hour session at a time that suits his schedule.
- Pay safely using card or eZ Cash without sharing sensitive details with the platform.
- Join the video session directly from the platform on his phone.
- Read ratings and comments from previous students before choosing a tutor.

**Frustrations:**
- No central place to compare tutors — currently has to contact each one separately.
- Tutor prices and availability are often unclear until after first contact.
- Slow-loading pages on mobile data cause him to abandon apps.
- Unsure whether an online tutor is genuinely qualified.
- Anxious about paying online if the payment flow is confusing or unclear.

---

### Persona 2 — Tutor

**Ms. Tharushi Fernando, Age 29, Colombo**

Part-time online tutor teaching O/L Mathematics and A/L Statistics. Works a primary day job and wants to earn additional income from evening and weekend teaching sessions.

**Goals:**
- Create a professional tutor profile showing subjects, grades, languages, and session price.
- Publish her available time slots so students can book without contacting her first.
- Accept or decline booking requests with full control over her schedule.
- Cancel bookings only when necessary and with adequate notice to the student.
- Receive weekly bank transfers for all completed sessions, with no manual chasing.
- Build a strong rating by delivering good sessions and getting honest feedback.

**Frustrations:**
- Manual payment tracking across multiple students is time-consuming and error-prone.
- Last-minute student cancellations waste her prepared time.
- Delayed or unclear payouts reduce her trust in the platform.
- She is not highly technical and needs a simple, reliable interface.
- Unfair or retaliatory ratings from difficult students could harm her visibility.

---

### Persona 3 — Operations Admin

**Nadeesha Jayawardena, Age 34, Colombo**

Operations staff member at LearnLanka responsible for tutor verification, booking oversight, payout processing, and user support. Works from the back-office admin panel.

**Goals:**
- Approve only qualified and verified tutors before they become visible to students.
- Monitor all bookings, sessions, and payment statuses across the platform.
- Calculate and initiate accurate weekly tutor payouts after deducting the 15% commission.
- Handle disputes about session completion, cancellation, and ratings fairly and quickly.
- Process personal data deletion requests in compliance with the PDPA 2022.
- Identify and disable accounts that violate platform rules.

**Frustrations:**
- Disputes arise when a student claims a session never happened but the tutor says it did.
- Payout calculations become complicated if cancellations and refunds are not clearly recorded.
- High volume of support requests without a structured ticketing flow is hard to manage.
- Weak tutor verification allows low-quality tutors to damage the platform's reputation.
- Privacy deletion requests need a clear audit trail to demonstrate PDPA compliance.

---

## 3. Functional Requirements

### 3.1 Student

- The system must allow a new user to register as a Student by providing a name, email address, phone number, and password, and must send an OTP to verify the phone number before the account is activated.
- A Student must be able to log in using their registered email address and password.
- A Student must be able to search for tutors by subject name.
- A Student must be able to filter search results by grade level (O/L or A/L).
- A Student must be able to filter search results by teaching language: Sinhala, Tamil, or English.
- A Student must be able to filter search results by price band (e.g. LKR 0–1,000 / 1,001–2,000 / 2,001+).
- The tutor search results page must display, for each tutor: name, subjects, teaching languages, hourly rate, and average star rating.
- A Student must be able to open a full tutor profile showing subjects, grade levels, languages, hourly rate, all available time slots, overall rating, and all one-line comments from previous students.
- A Student must be able to select one available 1-hour time slot from a tutor's profile and submit a booking request.
- A Student must be able to pay for a booking using card or eZ Cash through the PayHere gateway immediately after the tutor accepts the booking request.
- The platform must hold the booking in a 'payment pending' state for a maximum of 15 minutes after tutor acceptance; if payment is not completed within that window, the slot must be released back to availability.
- A Student must be able to view their session history grouped by status: Upcoming, Completed, and Cancelled.
- A Student must be able to join the video session at the scheduled time using the link provided by the platform.
- After a session is marked as completed, a Student must be able to rate the tutor from 1 to 5 stars and leave a comment of no more than one line.
- If a tutor cancels a confirmed booking, the Student must receive a full refund to their original payment method within 5 business days.
- A Student must be able to submit a request to delete their personal data, which must be processed within 30 days in accordance with the PDPA 2022.

### 3.2 Tutor

- The system must allow a new user to register as a Tutor by providing a name, email address, phone number, NIC number or equivalent ID, subjects taught, supported grades, teaching languages, and session price.
- A Tutor account must remain in a 'pending verification' state and must not appear in student search results until an Operations Admin approves the account.
- A Tutor must be able to update their profile at any time, including subjects, grades, languages, and session price.
- A Tutor must be able to add available 1-hour time slots to their calendar.
- A Tutor must be able to edit or remove availability slots that have not yet been booked by a Student.
- A Tutor must be able to view all incoming booking requests with the Student's name, requested time slot, and subject.
- A Tutor must be able to accept a booking request, which triggers the Student's payment step.
- A Tutor must be able to decline a booking request, which releases the slot back to availability with no charge to the Student.
- A Tutor must be able to cancel a confirmed, paid booking only if the session start time is at least 12 hours in the future; cancellations within 12 hours of the session must be blocked by the system.
- A Tutor must be able to view their session history grouped by status: Upcoming, Completed, and Cancelled.
- A Tutor must be able to join the video session at the scheduled time using the link provided by the platform.
- After a session is marked as completed, a Tutor must be able to rate the Student from 1 to 5 stars and leave a one-line comment.
- A Tutor must be able to view a weekly payout summary showing each completed session, the gross amount paid by the student, the 15% commission deducted, and the net amount due.
- A Tutor must be able to add or update their bank account details (bank name, branch, account number) for receiving weekly payouts via Sampath Vishwa.

### 3.3 Operations Admin

- The Operations Admin must be able to view a list of all tutor accounts with status: Pending, Approved, or Disabled.
- The Operations Admin must be able to review a tutor application and approve or reject it with a written reason.
- The Operations Admin must be able to view all Student accounts.
- The Operations Admin must be able to view all booking records with full details: student, tutor, subject, time slot, payment status, and session status.
- The Operations Admin must be able to view the calculated 15% commission and net tutor payout for each completed session.
- The Operations Admin must be able to generate a weekly payout batch for all tutors with completed sessions, ready for submission to Sampath Vishwa.
- The Operations Admin must be able to log and manage complaints from Students and Tutors related to bookings, cancellations, payments, and ratings.
- The Operations Admin must be able to review and, if necessary, remove ratings or comments that violate platform content rules.
- The Operations Admin must be able to process a personal data deletion request and record a completion timestamp for PDPA compliance.
- The Operations Admin must be able to disable or re-enable any Student or Tutor account.

### 3.4 Platform

- The platform must prevent double-booking: once a Student has submitted a booking request for a time slot, that slot must not be bookable by another Student until the request is declined or has expired.
- The platform must send in-app and/or SMS notifications to the relevant parties when: a booking request is received, a booking is accepted or declined, a payment is confirmed, a session is starting in 30 minutes, a session is completed, or a cancellation occurs.
- The platform must record the session completion status before calculating any commission or triggering any payout.
- The platform must never transmit or store card numbers, CVV values, or raw payment credentials on LearnLanka servers; all payment data must be handled exclusively by PayHere.
- All user-facing UI text including labels, error messages, and notifications must be available in Sinhala, Tamil, and English from launch day.
- The platform must capture explicit user consent for data collection at registration and store a timestamped record of that consent.

---

## 4. Non-Functional Requirements

| Category | Metric (SLI) | Target (SLO) | How We Will Measure It |
|----------|-------------|-------------|------------------------|
| Performance | Search API response time at the 95th percentile | < 800 ms from a Sri Lankan ISP | Azure Application Insights — track p95 on the /search endpoint |
| Availability | Successful response rate of the /book endpoint per calendar month | ≥ 99.5% monthly (allows ~3.6 hrs downtime) | Azure Monitor uptime checks + synthetic probes every 5 min |
| Scalability | Number of simultaneous active video sessions | ≥ 200 concurrent sessions within first 6 months | Daily.co or 100ms session dashboard + LearnLanka session logs |
| Privacy | Consent captured before personal data is collected | 100% of registered users must have a timestamped consent record | Database query on consent table; audited monthly by Ops Admin |
| Privacy | Personal data deletion completed within regulatory deadline | 100% of deletion requests processed within 30 calendar days | Admin deletion request log with completion timestamps |
| Payment Security | Card/payment data stored on LearnLanka servers | 0 card numbers, CVV values, or raw credentials stored | Quarterly database audit + PayHere integration security review |
| Payment Security | Payment gateway PCI-DSS compliance | 100% of card and eZ Cash payments processed through PayHere (PCI-DSS Level 1 certified) | PayHere compliance certificate review; integration testing |
| Mobile Usability | Core user flows functional on Android devices | Zero critical defects on Android 10+ in Chrome Mobile at launch; core flows render correctly on 360 px viewport | Manual and automated testing on Android 10, 11, 12 physical devices and BrowserStack |
| Localisation | UI strings available in all three supported languages | 100% of user-facing strings translated into Sinhala, Tamil, and English at launch | UI translation checklist; language-switching regression test suite |
| Payout Reliability | Tutor payouts initiated within agreed cycle | 100% of eligible payouts initiated within 7 calendar days of week end | Payout batch log in Admin panel with initiation timestamps |

---

## 5. Assumptions

The following items were not addressed in the original brief. Each is a silent gap that required a decision to write complete requirements.

- A Student cannot cancel a confirmed booking in v1. The brief only describes tutor cancellation with the 12-hour rule and is completely silent on student cancellation. It is assumed students must contact support to resolve cancellations, and no automated student cancellation flow is built in this version.
- If a Student's payment fails or times out after the Tutor accepts, the booking is automatically cancelled and the time slot is released back to availability after 15 minutes. The Student may attempt to book again. Without this rule the slot would be locked indefinitely.
- If a Tutor cancels a confirmed booking, the Student receives a full refund to their original payment method. The brief says tutors can cancel with 12 hours notice but never mentions what happens to the Student's money. Full refund is assumed.
- A session is marked as completed automatically by the platform once the scheduled end time passes and the video session was joined by both parties. Neither the Tutor nor the Student manually marks it complete. This definition drives commission calculation and payout eligibility.
- Session rescheduling is not supported in v1. The brief is silent on rescheduling. If either party cannot attend, the booking must be cancelled and a new booking made.
- The weekly payout period runs from Monday 00:00 to Sunday 23:59 Sri Lanka Standard Time. Payout transfers are initiated within 7 calendar days of that week ending. The brief says tutors are paid weekly but never defines the start day or transfer initiation date.

---

## 6. Out of Scope

The following features are explicitly excluded from version 1. They may be considered for future releases.

- Group classes or multi-student sessions. Version 1 supports only one-to-one tutor sessions.
- Session recording and playback. Video sessions are live only; no recordings are stored by the platform.
- In-app chat or direct messaging between Students and Tutors outside of the booking flow.
- iOS as a primary supported platform. Version 1 is Android-first; iOS may be added in a later release.
- Session rescheduling. Parties must cancel and re-book if a time change is needed.
- A LearnLanka internal accounting or invoicing system. Only commission and payout records are maintained.
- Coupon codes, promotional discounts, or referral programmes.
- Automated fraud detection or AI-based tutor quality scoring.
