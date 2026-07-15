
# Remaining Netlink modules

Cloning the four remaining Netlink feature areas into the ERP, adapted to the existing shadcn/Tailwind UI and multi-tenant RLS pattern already used across Attendance, Planning, and Finance.

## 1. Team Messaging (`/messages`)
- **DB**: `conversations` (direct/group/channel, tenant-scoped), `conversation_members` (role, last_read_at, muted), `messages` (body, attachments jsonb, reply_to_id, edited_at, deleted_at), `message_reactions` (emoji), `message_reads`.
- **Storage**: reuse `plan-attachments` pattern → new `message-attachments` bucket (private).
- **Realtime**: enable publication on `messages`, `conversation_members`, `message_reactions`.
- **UI**: `Messages.tsx` two-pane layout — conversation list (search, unread badges, presence dot) + thread pane (bubbles, reply, emoji reactions, file/image preview, @mentions). Composer with attachment upload, typing indicator via Realtime broadcast.
- **RLS**: user sees a conversation only if they are a member; only members can insert messages; sender or admin can soft-delete.

## 2. Performance Management (`/performance`)
- **DB**: `kpi_definitions` (name, unit, weight%, target, direction), `review_cycles` (period, status: draft/open/calibration/closed), `performance_reviews` (employee_id, cycle_id, self_score, manager_score, peer_score, final_score, calibration_notes), `review_feedback` (360°: peer/subordinate/manager, anonymous flag), `goals` (SMART goals linked to plans).
- Auto-compute `final_score = Σ(kpi_weight × normalized_score)` via trigger; write to existing `performance_summaries`.
- **UI**: `Performance.tsx` tabs — Cycles, My Reviews, Team Reviews (managers), KPI Library (HR admins configure weights, must sum ≤100%), 360 Feedback inbox, Calibration board (drag employees across rating bands).

## 3. Salary Management (`/salary`)
- Extends existing payroll. New tables: `salary_components` (basic/allowance/deduction, taxable, pensionable, formula), `employee_salary_structure` (per-employee assignment with amount/percent), `salary_advances` (request → approve → recover schedule), `bonuses` (one-off, taxable flag, payroll_run link).
- Extend `payslips` to embed component breakdown JSON.
- Ethiopian PAYE + 7%/11% pension already handled; salary advances create AR-like recovery lines auto-deducted next run.
- **UI**: `Salary.tsx` tabs — Components library, Structures (assign to employees, effective dates), Advances (request/approve/recover), Bonuses, Payslip preview with itemized breakdown, Export payslip PDF.

## 4. Departments & Team + Profile Editor
- **DB**: `departments` (name, code, parent_id for hierarchy, manager_user_id, budget, tenant), FK from `employees.department_id`. `department_members` optional if cross-department. Extend `profiles`: avatar_url, phone, address, emergency_contact, bio, skills[], socials jsonb.
- **UI**:
  - `Departments.tsx`: tree view, manager assignment, headcount, budget vs actual (from journals), sub-departments.
  - `Team.tsx`: org chart + directory grid (photo, role, dept, quick contact), search/filter.
  - `ProfileEditor.tsx` (route `/profile`): avatar upload (existing `employee-docs` bucket), personal info, skills chips, emergency contact, socials.

## Navigation & routing
Add sidebar entries and routes in `App.tsx` for `/messages`, `/performance`, `/salary`, `/departments`, `/team`, `/profile`. Group under existing HR section where appropriate.

## Technical notes
- All tables follow the four-step migration pattern: CREATE → GRANT → ENABLE RLS → POLICY, scoped by `current_tenant_id()` with `set_tenant_id` trigger.
- Reuse `has_role`, `is_hr_staff`, `is_finance_staff` helpers; add `is_manager_of(_user_id, _employee_id)` where needed.
- Realtime only on messaging tables to keep costs down.
- Use existing shadcn components; no new UI libraries.

## Execution order
1. Messaging migration + page (self-contained, highest user value).
2. Departments migration + Team/Profile pages (unblocks Performance references).
3. Performance migration + page.
4. Salary migration + page.

Each step will land as its own migration + page batch. Ready to start with step 1 on approval.
