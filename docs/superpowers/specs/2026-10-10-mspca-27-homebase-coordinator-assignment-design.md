# MSPCA-27: Homebase-based coordinator assignment — Design

**Branch:** `jw/mspca-27-homebase-coordinator-assignment` (off `jw/mspca-20-create-volunteer-endpoint`, PR #8)
**Date:** 2026-10-10

## Goal

Volunteers are supported by the coordinators at their homebase, so coordinator assignment follows from homebase:

- On account creation, a volunteer is assigned every active coordinator at their homebase.
- `PATCH /volunteers/:id/homebase` changes a volunteer's homebase, replaces their assigned coordinators with those at the new homebase, and emails both the coordinators who lost and those who gained the volunteer.

## Decisions

| Decision | Choice | Source |
|---|---|---|
| Storage for multiple coordinators | `@ManyToMany` join table (not an `int[]` column — no FK possible on an array) | Dalton |
| `homebase` in MSPCA-2's `UpdateVolunteerDto` | Kept | Justin |
| Homebase change via `PATCH /volunteers/:id` | Routes through the same reassignment + email logic (option A) | Justin |
| Email send failures | Logged, never thrown; emails sent after the save commits (same as `MatchesService.notifyCoordinator`) | Default |
| Which coordinators are assigned/emailed | Active coordinators only | Default |
| Volunteer status gate on homebase change | None — any status may change homebase | Default |
| Email fan-out | One email per coordinator (`sendEmail` takes a single `toEmail`; avoids exposing addresses) | Default |
| Email on account creation | None — ticket only requires emails on homebase change | Default |
| Auth/ownership on new endpoint | None, consistent with other volunteer endpoints | Default |
| Coordinator-side changes (new coordinator, deactivation, coordinator homebase change) | Do not resync volunteers; follow-up ticket | Out of scope |

The two homebase decisions (`homebase` kept in `UpdateVolunteerDto`; `PATCH /volunteers/:id` routes through reassignment) must be called out in the PR description under "Decisions open to review", along with the join-table choice.

## 1. Data model and migration

### Entities

- `FosterVolunteer.assignedCoordinator: FosterCoordinator | null` (`@ManyToOne`) → `assignedCoordinators: FosterCoordinator[]` (`@ManyToMany`). Volunteer is the owning side and declares the `@JoinTable`:
  ```ts
  @ManyToMany(() => FosterCoordinator, (c) => c.assignedVolunteers)
  @JoinTable({
    name: 'volunteer_coordinator_assignments',
    joinColumn: { name: 'volunteer_id', referencedColumnName: 'volunteerId' },
    inverseJoinColumn: { name: 'coordinator_id', referencedColumnName: 'coordinatorId' },
  })
  assignedCoordinators!: FosterCoordinator[];
  ```
- `FosterCoordinator.assignedVolunteers` `@OneToMany` → `@ManyToMany(() => FosterVolunteer, (v) => v.assignedCoordinators)`.

### Join table `volunteer_coordinator_assignments`

- `volunteer_id int NOT NULL` → FK `foster_volunteers(volunteer_id) ON DELETE CASCADE`
- `coordinator_id int NOT NULL` → FK `foster_coordinators(coordinator_id) ON DELETE CASCADE`
- Composite primary key `(volunteer_id, coordinator_id)`.

### Migration `ReplaceAssignedCoordinatorWithJoinTable`

- **up:** create the join table; backfill with
  `INSERT INTO volunteer_coordinator_assignments (volunteer_id, coordinator_id) SELECT volunteer_id, assigned_coordinator_id FROM foster_volunteers WHERE assigned_coordinator_id IS NOT NULL`;
  drop constraint `fk_volunteer_coordinator`; drop column `assigned_coordinator_id`.
- **down:** re-add `assigned_coordinator_id int` with `fk_volunteer_coordinator`; backfill with the lowest `coordinator_id` per volunteer (down is lossy by nature); drop the join table.
- Registered in `config/migrations.ts`.

### Consumers updated for the rename

- `VolunteersService.findByIdOrFail`: `relations: ['assignedCoordinators']`. All endpoints using it return the full coordinator list.
- `MatchesService.notifyCoordinator`: iterates `volunteer.assignedCoordinators`, sending one email per coordinator, each failure logged independently. An empty list logs the existing "no assigned coordinator" warning and sends nothing.

## 2. Coordinator lookup and account creation

### `CoordinatorsService.findActiveByHomebase(homebase: Homebase): Promise<FosterCoordinator[]>`

`repo.find({ where: { homebase, active: true }, order: { coordinatorId: 'ASC' } })`. Returns `[]` when none match; never throws for an empty result.

### `VolunteersService.create`

1. Existing-email check (unchanged; `ConflictException`).
2. `assignedCoordinators = await coordinatorsService.findActiveByHomebase(dto.homebase)`. Runs **before** Cognito so a lookup failure leaves nothing to roll back.
3. Cognito `createUser` (unchanged).
4. `repo.save({ ...dto, email, status: PENDING, mostRecentWaiverSigned: true, cognitoSub, assignedCoordinators })`. Coordinators already exist, so no cascade is needed for TypeORM to write join rows.
5. Save-failure Cognito rollback unchanged.

`POST /volunteers` responses now include `assignedCoordinators` (possibly `[]`).

## 3. Homebase endpoint, reassignment, and emails

### DTO `volunteers/dtos/update-homebase.dto.ts`

```ts
export class UpdateHomebaseDto {
  @ApiProperty({ enum: Homebase })
  @IsEnum(Homebase)
  homebase!: Homebase;
}
```

### Controller

```ts
@Patch('/:id/homebase')
async updateHomebase(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateHomebaseDto,
): Promise<FosterVolunteer> {
  validateId(id, 'Volunteer');
  return this.volunteersService.changeHomebase(id, dto.homebase);
}
```

With `@ApiOperation` / `@ApiParam` / `@ApiResponse` decorators matching `deactivate`/`reactivate`.

### `VolunteersService.changeHomebase(id, homebase)`

1. `volunteer = await this.findByIdOrFail(id)` (404 if missing; loads `assignedCoordinators`).
2. If `homebase === volunteer.homebase`: throw `new BadRequestException(\`Volunteer with ID ${id} is already assigned to the ${homebase} homebase\`)`.
3. `return this.reassignCoordinators(volunteer, homebase)`.

### `VolunteersService.reassignCoordinators(volunteer, homebase)` (private)

1. `previous = volunteer.assignedCoordinators`.
2. `next = await coordinatorsService.findActiveByHomebase(homebase)`.
3. `volunteer.homebase = homebase; volunteer.assignedCoordinators = next; saved = await repo.save(volunteer)`.
4. After the save commits:
   - **removed** = coordinators in `previous` not in `next` (by `coordinatorId`), filtered to `active` → each gets the "lost volunteer" email.
   - **added** = coordinators in `next` not in `previous` (by `coordinatorId`) → each gets the "gained volunteer" email.
   - Sends are sequential, each in its own `try/catch`; failures are logged with `logger.error` including volunteer and coordinator IDs, and never rethrown.
5. Return `saved`.

"Removed" uses the volunteer's actually-assigned coordinators rather than re-querying the old homebase, so the people notified are exactly those who lost the volunteer.

### Post-MSPCA-2 merge

`updateVolunteerById` calls `reassignCoordinators` only when `dto.homebase` is present **and** differs from the current homebase. A same-homebase value through the general update is a silent no-op for that field (no 400); the 400 is specific to the dedicated endpoint.

### Email bodies `volunteers/volunteers.emails.ts`

- `coordinatorGainedVolunteerEmail(volunteer: FosterVolunteer): { subject: string; bodyHtml: string }`
- `coordinatorLostVolunteerEmail(volunteer: FosterVolunteer, newHomebase: Homebase): { subject: string; bodyHtml: string }`
- Placeholder copy with a `TODO` for the real template (same convention as matches).
- Volunteer names are HTML-escaped via a small local `escapeHtml` helper, since they are user-supplied signup input.

### Module wiring

`VolunteersModule` imports `AWSSESModule` (`aws/ses/email.module.ts`); `EmailsService` is injected into `VolunteersService`.

## 4. Error handling

| Case | Source | Response |
|---|---|---|
| Non-numeric id | `ParseIntPipe` | 400 |
| id ≤ 0 | `validateId` | 400 |
| Volunteer not found | `findByIdOrFail` | 404 `Volunteer with ID ${id} not found` |
| `homebase` missing / not in enum | ValidationPipe on `UpdateHomebaseDto` | 400 |
| Same homebase | `changeHomebase` | 400 `Volunteer with ID ${id} is already assigned to the ${homebase} homebase` |
| No coordinators at new homebase | — | 200, `assignedCoordinators: []`, no "gained" emails |
| Email send failure | `reassignCoordinators` | 200; logged |
| Save failure | — | Propagates; no emails sent |

## 5. Testing

Conventions: every `toHaveBeenCalledWith` paired with `toHaveBeenCalledTimes`; exact error messages; failure tests assert calls made before the failure; DTO fixtures typed with `as XDto`; controller specs keep one generic error-propagation test.

- **`coordinators.service.spec.ts`** — `findActiveByHomebase` passes correct `where`/`order` and returns results; returns `[]` when none.
- **`volunteers.service.spec.ts`**
  - `create`: saves with looked-up coordinators; saves `[]` when none; lookup throws → Cognito `createUser` not called.
  - `changeHomebase`: happy path (save args, "gained" emails to each new coordinator, "lost" emails to each old, counts and recipients); not found → exact 404, no lookup/save/email; same homebase → exact 400, nothing downstream; empty new homebase → save with `[]`, only "lost" emails; no previous coordinators → only "gained" emails; one send rejects → resolves, remaining sends attempted, `logger.error` once; save rejects → propagates, no emails; inactive previous coordinators not emailed.
  - `findByIdOrFail`: `relations: ['assignedCoordinators']`.
- **`volunteers.emails.spec.ts`** — subject/body contain volunteer name and ID; HTML in a name is escaped.
- **`volunteers.controller.spec.ts`** — `updateHomebase` calls `changeHomebase(id, dto.homebase)` once and returns its result; service errors propagate; `UpdateHomebaseDto` validation via `validate(plainToInstance(...))` (valid enum passes; invalid and missing fail).
- **`matches.service.spec.ts`** — `notifyCoordinator` emails every assigned coordinator; empty list warns and sends nothing; one send failure does not stop the others.
- **Migration** — no unit test (consistent with existing migrations); verify with `migration:run` then `migration:revert` against a local database.

## Out of scope

- Resyncing volunteers when coordinators are created, deactivated, or change homebase.
- Real email template copy.
- Auth/ownership checks on volunteer endpoints.
- None of MSPCA-2 is on this branch's base. Before opening the PR, `origin/main` (which has MSPCA-2) is merged in and `updateVolunteerById` is wired to `reassignCoordinators` as described in §3 — that wiring IS in scope for this PR.
