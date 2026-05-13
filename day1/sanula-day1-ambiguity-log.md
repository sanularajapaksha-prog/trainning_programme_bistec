# LearnLanka — Ambiguity Hunt Log

## Brief reference

> "LearnLanka is a Colombo-based startup that connects O/L and A/L students with vetted tutors for one-to-one online sessions. Students must be able to search for tutors by subject, grade, language (Sinhala, Tamil, English), and price band. Students must be able to book a 1-hour session with a tutor and pay via card or eZ Cash. Tutors must be able to publish availability slots, accept or decline bookings, and cancel with at least 12 hours notice. The platform must charge a 15% commission on every completed session and pay tutors weekly via bank transfer. Both parties must be able to rate each other (1–5 stars) and leave a one-line comment after the session."

Ambiguous phrases highlighted for discussion: **vetted**, **price band**, **completed session**, **at least 12 hours notice**, **weekly**, **after the session**, **both parties**.

---

## Findings

| # | Quote from brief | Why it is ambiguous | Clarification question | Priority |
|---|-----------------|---------------------|------------------------|----------|
| 1 | "vetted tutors" | The brief says tutors are vetted but never says who vets them, what criteria are used, or whether vetting is manual or automated. Without this, the admin workflow and tutor registration form cannot be designed. | Who performs tutor vetting — an internal Operations Admin, an automated check, or a third-party background service? What documents or credentials must a tutor submit to be approved? | H |
| 2 | "cancel with at least 12 hours notice" | The brief only mentions tutor cancellation with a 12-hour rule. It says nothing about whether students can cancel, and if so, under what conditions or notice period. This is a major silent gap that affects refund logic and scheduling. | Can students cancel a confirmed booking? If yes, what is the notice period and is there a cancellation fee or partial refund? | H |
| 3 | "completed session" | The brief uses "completed session" as the trigger for commission calculation and ratings, but never defines what makes a session complete. Does the system mark it automatically after the time slot ends? Does the tutor confirm it? Does both parties need to join? | What is the exact definition of a completed session — is it time-based, attendance-based, or manually confirmed? Who has the authority to mark a session as complete? | H |
| 4 | "pay tutors weekly via bank transfer" | The brief says weekly payouts but never defines the start and end of the payout week, the day transfers are initiated, or how many days after the week ends the transfer is sent. Without this, the payout schedule cannot be built. | Does the payout week run Monday to Sunday? On which day are transfers initiated, and how many business days after the week closes? | H |
| 5 | "price band" | The brief says students can filter by price band but never defines what the bands are — whether they are fixed tiers (e.g. LKR 0–1,000 / 1,001–2,000) or dynamic ranges, and who sets them. | What are the specific price band ranges? Are they fixed platform-wide or does each tutor set their own range? Can bands change over time? | H |
| 6 | "book a 1-hour session" | The brief states sessions are 1 hour but never says whether this is the only allowed duration or if other lengths will be supported. It also does not say whether the session time is shown in Sri Lanka Standard Time or the user's local timezone. | Is 1 hour the only session length in v1? Is all scheduling displayed in Sri Lanka Standard Time (SLST) only? | M |
| 7 | "both parties must be able to rate each other" | The brief says rating happens "after the session" but does not say how long the rating window stays open, whether rating is mandatory or optional, or what happens if only one party rates. | How long after a completed session can a rating be submitted? Is it optional or required to unlock a future booking? What happens if one party does not rate? | M |
| 8 | "leave a one-line comment" | A one-line comment is undefined in terms of character limit. On mobile, one line could mean 40 characters or 120 depending on screen size. Without a number, the field cannot be built or validated. | What is the maximum character limit for the one-line comment — is it 100, 150, or 200 characters? | M |
| 9 | "15% commission on every completed session" | The brief says 15% commission on every completed session, but does not say whether the commission is on the gross fee paid by the student, or on some other base. It also does not address what happens to commission when a session is disputed. | Is the 15% commission calculated on the full gross amount paid by the student? What happens to the commission if a session is disputed and a refund is issued — is it also refunded? | M |
| 10 | "pay via card or eZ Cash" | The brief mentions card and eZ Cash as payment methods but does not specify which card types are accepted (Visa, Mastercard, AMEX), whether PayHere handles eZ Cash natively, or whether any payment methods will be added later. | Which card networks are in scope for launch — Visa and Mastercard only, or also AMEX? Does PayHere's current Sri Lanka integration support eZ Cash out of the box? | M |
| 11 | "Sinhala, Tamil, English" | The brief says all UI strings must support three languages from launch, but never addresses right-to-left rendering requirements, who is responsible for translations, or whether machine translation is acceptable. | Are translations being prepared by a professional translator or generated automatically? Is there a process for reviewing translated strings before launch? | M |
| 12 | "support 200 simultaneous video sessions in the first 6 months" | The brief says 200 concurrent sessions in the first 6 months but does not say what the target should be after 6 months. Capacity planning and pricing tiers for the video provider cannot be set without a growth projection. | What is the concurrent session target beyond the 6-month mark — is there a 12-month or 18-month projection? | L |
| 13 | "Ops Admin" persona | The brief implies there is an operations admin role but never says how many admins there are, whether there are admin roles within admin (e.g. super admin vs standard), or whether admins can be added by other admins. | Is there a single Operations Admin account at launch, or are there multiple admin users? Are there different permission levels within the admin role? | L |

---

## Results Summary

| Metric | Target | Achieved |
|--------|--------|----------|
| Items found | 10+ | 13 |
| High-priority items | 3+ | 5 |
| Items convertible to test cases | 5+ | 10 |

---

## Top 3 questions to ask the founders

1. **What defines a completed session?** This is the most architecturally important question because the answer directly controls when commission is calculated, when payouts are triggered, and when ratings unlock. If the definition is wrong, the entire financial flow of the platform is built on the wrong trigger.

2. **Can students cancel a confirmed booking, and under what conditions?** The brief gives a clear 12-hour cancellation rule for tutors but says nothing about students. If students can cancel freely, tutors lose income unpredictably. If students cannot cancel at all, students have no recourse for emergencies. The answer shapes the refund policy, the payout logic, and tutor trust in the platform.

3. **Who vets tutors and what does vetting involve?** LearnLanka's entire value proposition rests on students trusting that tutors are qualified. If vetting is just a manual admin approval with no document check, that needs to be stated. If it involves NIC verification, certificate review, or a background check, that changes the tutor registration form, the admin workflow, and the timeline to onboard tutors.

---

## Reflection

**What kind of ambiguity was most common?**
The most common type was definitional ambiguity — words that sound clear in conversation but collapse when you try to build them. "Completed session", "vetted", "weekly", and "one-line comment" all felt obvious in the brief but each required a decision that would directly affect the database schema, the UI, or the financial calculations. Vague nouns and adjectives were far more dangerous than missing features.

**Which question is most likely to change the architecture if answered differently?**
The definition of a completed session. If the answer is "the system marks it complete automatically after the time slot ends", the platform needs a scheduled job that runs at session end time and checks attendance logs from the video provider. If the answer is "the tutor manually confirms it", the platform needs a confirmation UI, a dispute flow for when tutors do not confirm, and a timeout fallback. These are two very different architectures. Getting this wrong means rebuilding the commission engine, the payout trigger, and the rating unlock flow — all at once.

