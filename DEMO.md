# Greensafe Assure — demo walkthrough

**Everything here is fictional.** A persistent banner says so on every page.

## Sign-in credentials

Password for every account is `greensafe`.

| Role | Email | Lands on |
|---|---|---|
| Director | `karu@greensafe.test` | Overview (exposure) |
| Deployment Coordinator | `coord@greensafe.test` | Register / Assign |
| Training Administrator | `trainingadmin@greensafe.test` | Register |
| Deployed Officer | `officer@greensafe.test` | own record only |

## The sixty-second path (sign in as Director)

1. **Overview.** One officer is **deployed under a lapsed certification** — the
   red exposure banner and the "lapsed, deployed" tile both read 1. This is the
   number the product exists to keep at zero. Also: one expiring ≤90 days, one
   open override.
2. **Register.** Personnel sorted **worst-status-first, not alphabetical** —
   R. Sundaram (lapsed) at the top, then Mohamed Faizal (expiring), then valid
   officers. Status is colour + icon + text, never colour alone.
3. **Certifications.** The expiry board — R. Sundaram's WSHO sits in *Lapsed*,
   Faizal's in *≤30 days*.
4. **Deployments.** Three active postings. R. Sundaram's is flagged
   **Overridden** in red — deployed despite the block, by a Director override.
5. **Assign** (as Coordinator). Pick the WSHO role and a site. The officer list
   pre-sorts: ✓ eligible, ▲ conditional, ✕ blocked with the reason inline. Pick
   R. Sundaram → the panel goes **red, Blocked**, Save disabled. Pick Ng Siew
   Ling → **green, Confirmed**. The server enforces this, not just the screen.
6. **Activity log** (as Director) + the **notification bell** — the escalation
   cascade has already produced renewal tasks and notifications; nothing was
   sent anywhere.

## What to say about it

"A working demo on live infrastructure, running invented data. The core is real
— the database enforces the rules, not just the interface, with around eighty
tests behind it. It is not yet production software: it needs proper key
management, real authentication, and answers to thirteen questions only Greensafe
can give. Those thirteen are the point of the meeting."

Do **not** call it production-ready, enterprise-grade, or ready to integrate.
