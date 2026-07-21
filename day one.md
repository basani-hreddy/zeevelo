# Advanced Ethical Hacking Academy Platform

**Goal**: Build a complete, professional, self-hosted web platform that teaches ethical hacking from absolute beginner to advanced certification level (CEH, eJPT, OSCP, PNPT, CRTP equivalent).

**Requirements**:

- Progressive curriculum: Beginner → Intermediate → Advanced

- Interactive real-time labs (Docker-based isolated vulnerable environments)

- Modern, beautiful UI with progress tracking, badges, leaderboards

- Strong ethical guardrails and legal disclaimers everywhere

- Fully responsive, dark mode, professional design

- User authentication (local + optional OAuth)

- Challenge submission with flag verification

- Built-in terminal emulator for practice

- Admin panel to add new modules/labs easily

**Tech Stack (must use)**:

- Next.js 15 (App Router) + TypeScript

- Tailwind CSS + shadcn/ui + Radix

- PostgreSQL + Prisma ORM

- Docker + Docker Compose for the whole platform + individual labs

- NextAuth.js or Clerk for auth

- WebSocket or Server-Sent Events for real-time feedback

- xterm.js for terminal

**Curriculum Structure** (must cover everything):

Phase 1: Fundamentals (Networking, Linux, Python/Bash, Web Basics)

Phase 2: Recon, Scanning, Enumeration, Web Security (OWASP Top 10)

Phase 3: Exploitation, Metasploit, PrivEsc, Post-Exploitation

Phase 4: Advanced (AD Attacks, Evasion, Reporting, Bug Bounty)

Each module needs:

- Theory pages (markdown rendered)

- Hands-on labs (spin up Docker containers on demand)

- Quizzes + practical challenges with flags

- Video/embed resources (ethical only)

**Must be more advanced than basic versions**:

- Dynamic lab provisioning (start/stop containers per user)

- Save lab state where possible

- AI assistant inside the platform (optional integration)

- Exportable certificates of completion

- CTF-style tournament mode

- Comprehensive logging and analytics

**Security & Ethics**:

- All labs 100% isolated

- No possibility to attack external systems

- Clear warnings on every page

Deliver the full project structure with all necessary files, Dockerfiles, Prisma schema, and detailed deployment instructions.

Start by creating the complete folder structure and core files.



**Additional Instructions**:

- First, output the complete folder structure with all file paths.

- Then, create the core files one by one (package.json, next.config.js, Prisma schema, Dockerfiles, main layout, authentication setup, etc.).

- Make the platform production-ready with proper error handling, security headers, and rate limiting.

- Include sample content for at least Phase 1 (Fundamentals) so I can see how modules and labs work.

- Provide clear step-by-step deployment instructions for both local development and production (Vercel + Railway/DigitalOcean).

- Use best practices for 2026 (App Router, Server Actions, streaming where appropriate).

Start building now.
