# MSPCA-27 Homebase Coordinator Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assign volunteers every active coordinator at their homebase on signup, and add `PATCH /volunteers/:id/homebase` to move a volunteer, reassign their coordinators, and email both sides.

**Architecture:** Replace the `FosterVolunteer.assignedCoordinator` many-to-one with an `assignedCoordinators` many-to-many backed by a `volunteer_coordinator_assignments` join table. `CoordinatorsService.findActiveByHomebase` supplies coordinator lists; `VolunteersService.reassignCoordinators` (private, shared by `changeHomebase` and, after merging main, `updateVolunteerById`) saves the new list and then sends best-effort emails built by `volunteers.emails.ts`.

**Tech Stack:** NestJS 10, TypeORM (Postgres, hand-written migrations, `synchronize: false`), class-validator, Jest, AWS SES via `EmailsService`.

**Spec:** `docs/superpowers/specs/2026-10-10-mspca-27-homebase-coordinator-assignment-design.md`

## Global Constraints

- Join table name `volunteer_coordinator_assignments`; columns `volunteer_id`, `coordinator_id`; composite PK; both FKs `ON DELETE CASCADE`.
- Entity property names: `FosterVolunteer.assignedCoordinators: FosterCoordinator[]`, `FosterCoordinator.assignedVolunteers: FosterVolunteer[]`.
- Only `active` coordinators are assigned or emailed.
- Emails are sent **after** `repo.save` resolves, one per coordinator, each in its own `try/catch`; failures are logged with `logger.error` and never rethrown.
- Same-homebase error message, exact: `` `Volunteer with ID ${id} is already assigned to the ${homebase} homebase` `` (`BadRequestException`).
- Not-found message unchanged: `` `Volunteer with ID ${id} not found` ``.
- Spec conventions (Dalton): every `toHaveBeenCalledWith` on a mock is paired with `toHaveBeenCalledTimes(n)`; assert exact error instances (`rejects.toThrow(new XException('...'))`); failure tests assert calls made before the failure; DTO fixtures use `as XDto`; controller specs keep only a generic "propagates errors thrown by the service" test.
- No `@ApiProperty` on DTOs — none of the existing DTOs use it (corrects spec §3).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands run from repo root `C:\Users\Justin Wang\repos\mspca`. Baseline before Task 1: `npx jest apps/backend/src/coordinators apps/backend/src/volunteers apps/backend/src/matches` → 6 suites, 71 tests passing; `npx tsc -p apps/backend/tsconfig.spec.json --noEmit` clean.

## Review Focus

1. **A coordinator present in both the old and new lists** (e.g. a coordinator whose own homebase was changed to the volunteer's new one) must stay assigned and receive **no** email — they lost nothing and gained nothing. Test in Task 5.
2. **Homebase strings that differ only in case or whitespace** (`"boston"`, `" Boston"`) must be rejected with 400, not silently matched. Test in Task 6.
3. **Every email send failing** must still return the saved volunteer and log once per failed coordinator. Test in Task 5.
4. **`PATCH /volunteers/:id` with `homebase` equal to the current value** (after the MSPCA-2 merge) must not reassign, not email, and not 400. Test in Task 7.
5. **Migration over real data**: volunteers with `NULL` coordinator get no join rows; `down` picks the lowest coordinator ID for a volunteer with several. Verified manually in Task 8.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/backend/src/coordinators/coordinators.service.ts` | Modify | Add `findActiveByHomebase` |
| `apps/backend/src/coordinators/coordinators.entity.ts` | Modify | `assignedVolunteers` → `@ManyToMany` |
| `apps/backend/src/volunteers/volunteers.entity.ts` | Modify | `assignedCoordinator` → `assignedCoordinators` `@ManyToMany` + `@JoinTable` |
| `apps/backend/src/migrations/1791100000000-ReplaceAssignedCoordinatorWithJoinTable.ts` | Create | Schema + data migration |
| `apps/backend/src/config/migrations.ts` | Modify | Register migration |
| `apps/backend/src/matches/matches.service.ts` | Modify | Email every assigned coordinator |
| `apps/backend/src/volunteers/volunteers.emails.ts` | Create | Email subject/body builders + HTML escaping |
| `apps/backend/src/volunteers/dtos/update-homebase.dto.ts` | Create | Validate `homebase` |
| `apps/backend/src/volunteers/volunteers.service.ts` | Modify | Populate on create; `changeHomebase`; `reassignCoordinators`; `notifyCoordinators` |
| `apps/backend/src/volunteers/volunteers.controller.ts` | Modify | `PATCH /:id/homebase` |
| `apps/backend/src/volunteers/volunteers.module.ts` | Modify | Import `AWSSESModule` |
| Matching `*.spec.ts` files | Modify/Create | Tests |

---

### Task 1: `CoordinatorsService.findActiveByHomebase`

**Files:**
- Modify: `apps/backend/src/coordinators/coordinators.service.ts`
- Test: `apps/backend/src/coordinators/coordinators.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CoordinatorsService.findActiveByHomebase(homebase: Homebase): Promise<FosterCoordinator[]>` — active coordinators at `homebase`, ordered by `coordinatorId` ascending; `[]` when none.

- [ ] **Step 1: Write the failing tests**

In `coordinators.service.spec.ts`, add the import and extend the repo mock:

```ts
import { Homebase } from '../types';
```

```ts
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
```

Add this `describe` after the `findByIdOrFail` block:

```ts
  describe('findActiveByHomebase', () => {
    it('returns the active coordinators at the homebase ordered by id', async () => {
      const coordinators = [
        { coordinatorId: 2, homebase: Homebase.SALEM, active: true },
        { coordinatorId: 5, homebase: Homebase.SALEM, active: true },
      ] as FosterCoordinator[];
      repo.find.mockResolvedValue(coordinators);

      const result = await service.findActiveByHomebase(Homebase.SALEM);

      expect(result).toBe(coordinators);
      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { homebase: Homebase.SALEM, active: true },
        order: { coordinatorId: 'ASC' },
      });
    });

    it('returns an empty array when the homebase has no active coordinators', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findActiveByHomebase(Homebase.CAPE_COD);

      expect(result).toEqual([]);
      expect(repo.find).toHaveBeenCalledTimes(1);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest apps/backend/src/coordinators/coordinators.service.spec.ts`
Expected: FAIL — `service.findActiveByHomebase is not a function` (TS error `Property 'findActiveByHomebase' does not exist`).

- [ ] **Step 3: Implement**

In `coordinators.service.ts`, add `import { Homebase } from '../types';` and this method after `findByIdOrFail`:

```ts
  /**
   * Fetches the active Coordinators at a homebase.
   *
   * @param homebase - The homebase to look up.
   * @returns The active Coordinators, ordered by ID, or an empty array if none.
   */
  findActiveByHomebase(homebase: Homebase): Promise<FosterCoordinator[]> {
    return this.repo.find({
      where: { homebase, active: true },
      order: { coordinatorId: 'ASC' },
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest apps/backend/src/coordinators/coordinators.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/coordinators/coordinators.service.ts apps/backend/src/coordinators/coordinators.service.spec.ts
git commit -m "Add CoordinatorsService.findActiveByHomebase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Many-to-many join table, migration, and consumers

This task must land as one commit: renaming the entity property breaks `VolunteersService` and `MatchesService` until both are updated.

**Files:**
- Modify: `apps/backend/src/volunteers/volunteers.entity.ts`
- Modify: `apps/backend/src/coordinators/coordinators.entity.ts`
- Create: `apps/backend/src/migrations/1791100000000-ReplaceAssignedCoordinatorWithJoinTable.ts`
- Modify: `apps/backend/src/config/migrations.ts`
- Modify: `apps/backend/src/volunteers/volunteers.service.ts` (`findByIdOrFail` only)
- Modify: `apps/backend/src/matches/matches.service.ts`
- Test: `apps/backend/src/volunteers/volunteers.service.spec.ts`, `apps/backend/src/matches/matches.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FosterVolunteer.assignedCoordinators: FosterCoordinator[]` (loaded by `findByIdOrFail` via `relations: ['assignedCoordinators']`); `FosterCoordinator.assignedVolunteers: FosterVolunteer[]`.

- [ ] **Step 1: Update the specs to the new shape (failing)**

In `volunteers.service.spec.ts`, replace every `relations: ['assignedCoordinator'],` with `relations: ['assignedCoordinators'],` (4 occurrences — use replace-all). In the first `findByIdOrFail` test, add after the existing `toHaveBeenCalledWith`:

```ts
      expect(repo.findOne).toHaveBeenCalledTimes(1);
```

In `matches.service.spec.ts`, replace the fixtures at the top:

```ts
const coordinator = {
  coordinatorId: 7,
  email: 'coordinator@gmail.com',
} as FosterCoordinator;

const secondCoordinator = {
  coordinatorId: 8,
  email: 'second-coordinator@gmail.com',
} as FosterCoordinator;

const volunteerWithCoordinator = {
  volunteerId: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: VolunteerStatus.ACTIVE,
  assignedCoordinators: [coordinator],
} as FosterVolunteer;

const volunteerWithCoordinators = {
  ...volunteerWithCoordinator,
  assignedCoordinators: [coordinator, secondCoordinator],
} as FosterVolunteer;

const volunteerWithoutCoordinator = {
  ...volunteerWithCoordinator,
  assignedCoordinators: [],
} as FosterVolunteer;
```

Add these tests inside `describe('create')`, after `"emails the volunteer's assigned coordinator"`:

```ts
    it('emails every assigned coordinator', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinators,
      );
      emailsService.sendEmail.mockResolvedValue(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );

      await service.create({ volunteerId: 1, chameleonAnimalId: 42 });

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ toEmail: coordinator.email }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ toEmail: secondCoordinator.email }),
      );
    });

    it('still emails the remaining coordinators when one send fails', async () => {
      volunteersService.findActiveOrFail.mockResolvedValue(
        volunteerWithCoordinators,
      );
      emailsService.sendEmail
        .mockRejectedValueOnce(new Error('SES is down'))
        .mockResolvedValueOnce(undefined);
      matchRepo.create.mockImplementation((attrs) => attrs);
      matchRepo.save.mockImplementation((match) =>
        Promise.resolve({ matchId: 10, ...match }),
      );
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const match = await service.create({
        volunteerId: 1,
        chameleonAnimalId: 42,
      });

      expect(match.matchId).toEqual(10);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).toHaveBeenLastCalledWith(
        expect.objectContaining({ toEmail: secondCoordinator.email }),
      );
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('coordinator 7'),
        expect.any(String),
      );
    });
```

In the existing `'still creates the match when the volunteer has no coordinator'` test, change `expect(warn).toHaveBeenCalled();` to `expect(warn).toHaveBeenCalledTimes(1);`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest apps/backend/src/volunteers/volunteers.service.spec.ts apps/backend/src/matches/matches.service.spec.ts`
Expected: FAIL — TS errors that `assignedCoordinators` does not exist on `FosterVolunteer`, and `relations` mismatch.

- [ ] **Step 3: Update the entities**

`volunteers.entity.ts` — replace the typeorm import and the relation:

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
```

```ts
  @ManyToMany(
    () => FosterCoordinator,
    (coordinator) => coordinator.assignedVolunteers,
  )
  @JoinTable({
    name: 'volunteer_coordinator_assignments',
    joinColumn: { name: 'volunteer_id', referencedColumnName: 'volunteerId' },
    inverseJoinColumn: {
      name: 'coordinator_id',
      referencedColumnName: 'coordinatorId',
    },
  })
  assignedCoordinators!: FosterCoordinator[];
```

`coordinators.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
```

```ts
  @ManyToMany(
    () => FosterVolunteer,
    (volunteer) => volunteer.assignedCoordinators,
  )
  assignedVolunteers!: FosterVolunteer[];
```

- [ ] **Step 4: Write the migration**

Create `apps/backend/src/migrations/1791100000000-ReplaceAssignedCoordinatorWithJoinTable.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAssignedCoordinatorWithJoinTable1791100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "volunteer_coordinator_assignments" (
                "volunteer_id" int NOT NULL,
                "coordinator_id" int NOT NULL,
                CONSTRAINT "pk_volunteer_coordinator_assignments"
                    PRIMARY KEY ("volunteer_id", "coordinator_id"),
                CONSTRAINT "fk_assignment_volunteer"
                    FOREIGN KEY ("volunteer_id")
                    REFERENCES "foster_volunteers" ("volunteer_id")
                    ON DELETE CASCADE,
                CONSTRAINT "fk_assignment_coordinator"
                    FOREIGN KEY ("coordinator_id")
                    REFERENCES "foster_coordinators" ("coordinator_id")
                    ON DELETE CASCADE
            )
        `);

    // Each existing single assignment becomes a one-element list.
    await queryRunner.query(`
            INSERT INTO "volunteer_coordinator_assignments" ("volunteer_id", "coordinator_id")
            SELECT "volunteer_id", "assigned_coordinator_id"
            FROM "foster_volunteers"
            WHERE "assigned_coordinator_id" IS NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                DROP CONSTRAINT "fk_volunteer_coordinator",
                DROP COLUMN "assigned_coordinator_id"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                ADD COLUMN "assigned_coordinator_id" int,
                ADD CONSTRAINT "fk_volunteer_coordinator"
                    FOREIGN KEY ("assigned_coordinator_id")
                    REFERENCES "foster_coordinators" ("coordinator_id")
        `);

    // A single column can only hold one coordinator, so keep the lowest ID.
    await queryRunner.query(`
            UPDATE "foster_volunteers" AS v
            SET "assigned_coordinator_id" = a."coordinator_id"
            FROM (
                SELECT "volunteer_id", MIN("coordinator_id") AS "coordinator_id"
                FROM "volunteer_coordinator_assignments"
                GROUP BY "volunteer_id"
            ) AS a
            WHERE v."volunteer_id" = a."volunteer_id"
        `);

    await queryRunner.query(`DROP TABLE "volunteer_coordinator_assignments"`);
  }
}
```

Register it in `apps/backend/src/config/migrations.ts`:

```ts
import { ReplaceAssignedCoordinatorWithJoinTable1791100000000 } from '../migrations/1791100000000-ReplaceAssignedCoordinatorWithJoinTable';
```

and append `ReplaceAssignedCoordinatorWithJoinTable1791100000000,` as the last element of `schemaMigrations`.

- [ ] **Step 5: Update `VolunteersService.findByIdOrFail`**

Change `relations: ['assignedCoordinator'],` to `relations: ['assignedCoordinators'],` and the JSDoc first line to `Fetches a Volunteer by ID, with their assigned Foster Coordinators.`

- [ ] **Step 6: Update `MatchesService`**

In `create`, change `await this.notifyCoordinator(match, volunteer);` to `await this.notifyCoordinators(match, volunteer);` and update its JSDoc: "notifies the volunteer's assigned foster coordinators by email." and "Volunteers with no assigned coordinators still get a match; no email goes out."

Replace the whole `notifyCoordinator` method (JSDoc included) with:

```ts
  /**
   * Emails each of the volunteer's assigned foster coordinators about a new match.
   *
   * Never throws: the match is already committed by the time this runs, so a
   * volunteer with no coordinators is logged as a warning and each failed send
   * as an error rather than failing the request. One failed send does not stop
   * the remaining coordinators from being emailed.
   *
   * @param match the match that was just created
   * @param volunteer the matched volunteer, with assignedCoordinators loaded
   */
  private async notifyCoordinators(
    match: Match,
    volunteer: FosterVolunteer,
  ): Promise<void> {
    const coordinators = volunteer.assignedCoordinators;

    if (coordinators.length === 0) {
      this.logger.warn(
        `Volunteer ${volunteer.volunteerId} has no assigned coordinators; no match email sent for match ${match.matchId}.`,
      );
      return;
    }

    for (const coordinator of coordinators) {
      // Placeholder copy - TODO: put real template here later.
      try {
        await this.emailsService.sendEmail({
          toEmail: coordinator.email,
          subject: 'New foster match created',
          bodyHtml: `<p>A match has been created for ${volunteer.firstName} ${volunteer.lastName} (volunteer ${volunteer.volunteerId}) and Chameleon animal ${match.chameleonAnimalId}.</p>`,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send match creation email to coordinator ${coordinator.coordinatorId} for match ${match.matchId}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx jest apps/backend/src/coordinators apps/backend/src/volunteers apps/backend/src/matches`
Expected: PASS (all suites).
Run: `npx tsc -p apps/backend/tsconfig.spec.json --noEmit`
Expected: no output.
Run: `git grep -n "assignedCoordinator\b" -- apps/backend/src`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/volunteers/volunteers.entity.ts apps/backend/src/coordinators/coordinators.entity.ts apps/backend/src/migrations/1791100000000-ReplaceAssignedCoordinatorWithJoinTable.ts apps/backend/src/config/migrations.ts apps/backend/src/volunteers/volunteers.service.ts apps/backend/src/volunteers/volunteers.service.spec.ts apps/backend/src/matches/matches.service.ts apps/backend/src/matches/matches.service.spec.ts
git commit -m "Replace single assigned coordinator with many-to-many join table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Populate coordinators on volunteer creation

**Files:**
- Modify: `apps/backend/src/volunteers/volunteers.service.ts`
- Test: `apps/backend/src/volunteers/volunteers.service.spec.ts`

**Interfaces:**
- Consumes: `CoordinatorsService.findActiveByHomebase(homebase)` (Task 1); `FosterVolunteer.assignedCoordinators` (Task 2).
- Produces: `VolunteersService` constructor now takes `coordinatorsService: CoordinatorsService` (third parameter). Saved volunteers from `create` include `assignedCoordinators`.

- [ ] **Step 1: Write the failing tests**

In `volunteers.service.spec.ts` add imports:

```ts
import { CoordinatorsService } from '../coordinators/coordinators.service';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
```

Add the mock declaration next to `cognitoService`:

```ts
  let coordinatorsService: { findActiveByHomebase: jest.Mock };
```

In the top-level `beforeEach`, initialise it and add a provider:

```ts
    coordinatorsService = { findActiveByHomebase: jest.fn() };
```

```ts
        {
          provide: CoordinatorsService,
          useValue: coordinatorsService,
        },
```

Inside `describe('create')`, add a fixture after `dto` and stub it in the existing `beforeEach`:

```ts
    const bostonCoordinators = [
      { coordinatorId: 3, email: 'c3@example.com', active: true },
      { coordinatorId: 4, email: 'c4@example.com', active: true },
    ] as FosterCoordinator[];
```

```ts
      coordinatorsService.findActiveByHomebase.mockResolvedValue(
        bostonCoordinators,
      );
```

Update `'saves the volunteer as pending with a signed waiver and the Cognito sub'` so both the `repo.save` expectation and the `result` expectation include `assignedCoordinators: bostonCoordinators`:

```ts
      expect(repo.save).toHaveBeenCalledWith({
        ...dto,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: bostonCoordinators,
      });
      expect(result).toEqual({
        volunteerId: 1,
        ...dto,
        status: VolunteerStatus.PENDING,
        mostRecentWaiverSigned: true,
        cognitoSub: 'cognito-sub-123',
        assignedCoordinators: bostonCoordinators,
      });
```

Add new tests inside `describe('create')`:

```ts
    it("looks up the active coordinators at the volunteer's homebase", async () => {
      await service.create(dto);

      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledWith(
        Homebase.BOSTON,
      );
    });

    it('saves an empty coordinator list when the homebase has no coordinators', async () => {
      coordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      const result = await service.create(dto);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedCoordinators: [] }),
      );
      expect(result.assignedCoordinators).toEqual([]);
    });

    it('does not create the Cognito user when the coordinator lookup fails', async () => {
      const lookupError = new Error('connection lost');
      coordinatorsService.findActiveByHomebase.mockRejectedValue(lookupError);

      await expect(service.create(dto)).rejects.toBe(lookupError);
      expect(repo.findOneBy).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledTimes(1);
      expect(cognitoService.createUser).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
```

In the existing `'throws ConflictException without calling Cognito when the email is already in Postgres'` test, add:

```ts
      expect(coordinatorsService.findActiveByHomebase).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest apps/backend/src/volunteers/volunteers.service.spec.ts`
Expected: FAIL — save called without `assignedCoordinators`; `findActiveByHomebase` not called.

- [ ] **Step 3: Implement**

In `volunteers.service.ts` add the import and constructor parameter:

```ts
import { CoordinatorsService } from '../coordinators/coordinators.service';
```

```ts
  constructor(
    @InjectRepository(FosterVolunteer)
    private repo: Repository<FosterVolunteer>,
    private cognitoService: CognitoService,
    private coordinatorsService: CoordinatorsService,
  ) {}
```

In `create`, between the existing-email check and `cognitoService.createUser`, add:

```ts
    // Looked up before Cognito so a failure here leaves nothing to roll back.
    const assignedCoordinators =
      await this.coordinatorsService.findActiveByHomebase(dto.homebase);
```

and add `assignedCoordinators,` to the `repo.save({...})` object after `cognitoSub,`. Update the JSDoc: add the line "Assigns every active coordinator at the Volunteer's homebase." after "New Volunteers are pending until a coordinator approves them."

No module change is needed: `VolunteersModule` already imports `CoordinatorsModule`, which exports `CoordinatorsService`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest apps/backend/src/volunteers/volunteers.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/volunteers/volunteers.service.ts apps/backend/src/volunteers/volunteers.service.spec.ts
git commit -m "Assign homebase coordinators on volunteer creation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Coordinator reassignment email bodies

**Files:**
- Create: `apps/backend/src/volunteers/volunteers.emails.ts`
- Test: `apps/backend/src/volunteers/volunteers.emails.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `interface CoordinatorEmail { subject: string; bodyHtml: string }`
  - `coordinatorGainedVolunteerEmail(volunteer: FosterVolunteer): CoordinatorEmail` — uses `volunteer.homebase` as the (new) homebase.
  - `coordinatorLostVolunteerEmail(volunteer: FosterVolunteer, newHomebase: Homebase): CoordinatorEmail`

- [ ] **Step 1: Write the failing tests**

Create `volunteers.emails.spec.ts`:

```ts
import { Homebase } from '../types';
import { FosterVolunteer } from './volunteers.entity';
import {
  coordinatorGainedVolunteerEmail,
  coordinatorLostVolunteerEmail,
} from './volunteers.emails';

const volunteer = {
  volunteerId: 12,
  firstName: 'Ada',
  lastName: 'Lovelace',
  homebase: Homebase.SALEM,
} as FosterVolunteer;

describe('volunteer emails', () => {
  describe('coordinatorGainedVolunteerEmail', () => {
    it("names the volunteer and their new homebase", () => {
      const email = coordinatorGainedVolunteerEmail(volunteer);

      expect(email.subject).toBe('New volunteer assigned to you');
      expect(email.bodyHtml).toContain('Ada Lovelace');
      expect(email.bodyHtml).toContain('volunteer 12');
      expect(email.bodyHtml).toContain(Homebase.SALEM);
    });
  });

  describe('coordinatorLostVolunteerEmail', () => {
    it('names the volunteer and the homebase they moved to', () => {
      const email = coordinatorLostVolunteerEmail(volunteer, Homebase.SALEM);

      expect(email.subject).toBe('Volunteer moved to another homebase');
      expect(email.bodyHtml).toContain('Ada Lovelace');
      expect(email.bodyHtml).toContain('volunteer 12');
      expect(email.bodyHtml).toContain(Homebase.SALEM);
      expect(email.bodyHtml).toContain('no longer assigned to you');
    });
  });

  it('escapes HTML in the volunteer name', () => {
    const hostile = {
      ...volunteer,
      firstName: '<script>alert("x")</script>',
      lastName: "O'Brien & Co",
    } as FosterVolunteer;

    for (const email of [
      coordinatorGainedVolunteerEmail(hostile),
      coordinatorLostVolunteerEmail(hostile, Homebase.BOSTON),
    ]) {
      expect(email.bodyHtml).not.toContain('<script>');
      expect(email.bodyHtml).toContain(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
      );
      expect(email.bodyHtml).toContain('O&#39;Brien &amp; Co');
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest apps/backend/src/volunteers/volunteers.emails.spec.ts`
Expected: FAIL — `Cannot find module './volunteers.emails'`.

- [ ] **Step 3: Implement**

Create `volunteers.emails.ts`:

```ts
import { Homebase } from '../types';
import { FosterVolunteer } from './volunteers.entity';

export interface CoordinatorEmail {
  subject: string;
  bodyHtml: string;
}

// Volunteer names come from signup input, so escape them before putting them in HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describeVolunteer(volunteer: FosterVolunteer): string {
  const name = escapeHtml(`${volunteer.firstName} ${volunteer.lastName}`);
  return `${name} (volunteer ${volunteer.volunteerId})`;
}

// Placeholder copy - TODO: put real templates here later.

/**
 * Builds the email telling a coordinator a volunteer has been assigned to them.
 *
 * @param volunteer the volunteer, already updated to their new homebase
 */
export function coordinatorGainedVolunteerEmail(
  volunteer: FosterVolunteer,
): CoordinatorEmail {
  return {
    subject: 'New volunteer assigned to you',
    bodyHtml: `<p>${describeVolunteer(volunteer)} has moved to the ${volunteer.homebase} homebase and is now assigned to you.</p>`,
  };
}

/**
 * Builds the email telling a coordinator a volunteer is no longer assigned to them.
 *
 * @param volunteer the volunteer who moved
 * @param newHomebase the homebase the volunteer moved to
 */
export function coordinatorLostVolunteerEmail(
  volunteer: FosterVolunteer,
  newHomebase: Homebase,
): CoordinatorEmail {
  return {
    subject: 'Volunteer moved to another homebase',
    bodyHtml: `<p>${describeVolunteer(volunteer)} has moved to the ${newHomebase} homebase and is no longer assigned to you.</p>`,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest apps/backend/src/volunteers/volunteers.emails.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/volunteers/volunteers.emails.ts apps/backend/src/volunteers/volunteers.emails.spec.ts
git commit -m "Add coordinator reassignment email bodies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `VolunteersService.changeHomebase` and reassignment

**Files:**
- Modify: `apps/backend/src/volunteers/volunteers.service.ts`
- Modify: `apps/backend/src/volunteers/volunteers.module.ts`
- Test: `apps/backend/src/volunteers/volunteers.service.spec.ts`

**Interfaces:**
- Consumes: `CoordinatorsService.findActiveByHomebase` (Task 1); `coordinatorGainedVolunteerEmail`, `coordinatorLostVolunteerEmail` (Task 4); `EmailsService.sendEmail(dto: SendEmailDTO)` from `../aws/ses/email.service`.
- Produces:
  - `VolunteersService.changeHomebase(id: number, homebase: Homebase): Promise<FosterVolunteer>`
  - private `reassignCoordinators(volunteer: FosterVolunteer, homebase: Homebase): Promise<FosterVolunteer>` (Task 7 calls it)
  - Constructor gains a fourth parameter `emailsService: EmailsService`.

- [ ] **Step 1: Write the failing tests**

In `volunteers.service.spec.ts` add imports:

```ts
import { EmailsService } from '../aws/ses/email.service';
```

Add the mock declaration, initialise it in the top-level `beforeEach`, and provide it:

```ts
  let emailsService: { sendEmail: jest.Mock };
```

```ts
    emailsService = { sendEmail: jest.fn() };
```

```ts
        {
          provide: EmailsService,
          useValue: emailsService,
        },
```

Add an `afterEach` at the top level (after `beforeEach`) so logger spies never leak:

```ts
  afterEach(() => {
    jest.restoreAllMocks();
  });
```

Add this block at the end of the top-level `describe`:

```ts
  describe('changeHomebase', () => {
    const oldCoordinators = [
      { coordinatorId: 1, email: 'old1@example.com', active: true },
      { coordinatorId: 2, email: 'old2@example.com', active: true },
    ] as FosterCoordinator[];
    const newCoordinators = [
      { coordinatorId: 3, email: 'new3@example.com', active: true },
    ] as FosterCoordinator[];

    const makeVolunteer = (
      assignedCoordinators: FosterCoordinator[] = oldCoordinators,
    ) =>
      ({
        volunteerId: 9,
        firstName: 'Ada',
        lastName: 'Lovelace',
        homebase: Homebase.BOSTON,
        assignedCoordinators,
      }) as FosterVolunteer;

    beforeEach(() => {
      coordinatorsService.findActiveByHomebase.mockResolvedValue(
        newCoordinators,
      );
      repo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockResolvedValue(undefined);
    });

    it('saves the new homebase and replaces the coordinator list', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { volunteerId: 9 },
        relations: ['assignedCoordinators'],
      });
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledWith(
        Homebase.SALEM,
      );
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          volunteerId: 9,
          homebase: Homebase.SALEM,
          assignedCoordinators: newCoordinators,
        }),
      );
      expect(result.homebase).toBe(Homebase.SALEM);
      expect(result.assignedCoordinators).toBe(newCoordinators);
    });

    it('emails the old coordinators and the new coordinators', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          toEmail: 'old1@example.com',
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          toEmail: 'old2@example.com',
          subject: 'Volunteer moved to another homebase',
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          toEmail: 'new3@example.com',
          subject: 'New volunteer assigned to you',
        }),
      );
    });

    it('throws NotFoundException and does nothing else when the volunteer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.changeHomebase(9, Homebase.SALEM)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 9 not found'),
      );
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws BadRequestException and does nothing else when the homebase is unchanged', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());

      await expect(service.changeHomebase(9, Homebase.BOSTON)).rejects.toThrow(
        new BadRequestException(
          'Volunteer with ID 9 is already assigned to the Boston homebase',
        ),
      );
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('succeeds with an empty list and only emails the old coordinators when the new homebase has none', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());
      coordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result.assignedCoordinators).toEqual([]);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'New volunteer assigned to you' }),
      );
    });

    it('only emails the new coordinators when the volunteer had none', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer([]));

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'new3@example.com',
          subject: 'New volunteer assigned to you',
        }),
      );
    });

    it('sends no email when neither homebase has coordinators', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer([]));
      coordinatorsService.findActiveByHomebase.mockResolvedValue([]);

      await service.changeHomebase(9, Homebase.SALEM);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('does not email previously assigned coordinators who are now inactive', async () => {
      repo.findOne.mockResolvedValue(
        makeVolunteer([
          { coordinatorId: 1, email: 'old1@example.com', active: false },
        ] as FosterCoordinator[]),
      );

      await service.changeHomebase(9, Homebase.SALEM);

      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'new3@example.com' }),
      );
    });

    it('keeps and does not email a coordinator who is in both the old and new lists', async () => {
      const stays = {
        coordinatorId: 5,
        email: 'stays@example.com',
        active: true,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue(makeVolunteer([oldCoordinators[0], stays]));
      coordinatorsService.findActiveByHomebase.mockResolvedValue([
        stays,
        newCoordinators[0],
      ]);

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.assignedCoordinators).toEqual([stays, newCoordinators[0]]);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailsService.sendEmail).not.toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'stays@example.com' }),
      );
    });

    it('still returns the saved volunteer and emails the rest when one send fails', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());
      emailsService.sendEmail
        .mockRejectedValueOnce(new Error('SES is down'))
        .mockResolvedValue(undefined);
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.homebase).toBe(Homebase.SALEM);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('coordinator 1'),
        expect.any(String),
      );
    });

    it('still returns the saved volunteer and logs each failure when every send fails', async () => {
      repo.findOne.mockResolvedValue(makeVolunteer());
      emailsService.sendEmail.mockRejectedValue(new Error('SES is down'));
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();

      const result = await service.changeHomebase(9, Homebase.SALEM);

      expect(result.homebase).toBe(Homebase.SALEM);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(3);
      expect(logError).toHaveBeenCalledTimes(3);
    });

    it('propagates a save failure without sending any email', async () => {
      const dbError = new Error('connection lost');
      repo.findOne.mockResolvedValue(makeVolunteer());
      repo.save.mockRejectedValue(dbError);

      await expect(service.changeHomebase(9, Homebase.SALEM)).rejects.toBe(
        dbError,
      );
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });
  });
```

The existing `'logs the orphaned Cognito sub ...'` test calls `logError.mockRestore()` itself; leave it — `restoreAllMocks` is harmless alongside it.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest apps/backend/src/volunteers/volunteers.service.spec.ts`
Expected: FAIL — `service.changeHomebase is not a function`.

- [ ] **Step 3: Implement**

In `volunteers.service.ts` add imports:

```ts
import { Homebase } from '../types';
import { FosterCoordinator } from '../coordinators/coordinators.entity';
import { EmailsService } from '../aws/ses/email.service';
import {
  CoordinatorEmail,
  coordinatorGainedVolunteerEmail,
  coordinatorLostVolunteerEmail,
} from './volunteers.emails';
```

Add `private emailsService: EmailsService,` as the last constructor parameter.

Add after `reactivate`:

```ts
  /**
   * Moves a Volunteer to a different homebase and reassigns their coordinators.
   *
   * @param id - The Volunteer's ID.
   * @param homebase - The new homebase.
   * @returns The updated Volunteer, with their new assigned coordinators.
   * @throws {NotFoundException} If no Volunteer with the ID exists.
   * @throws {BadRequestException} If the Volunteer is already at the homebase.
   */
  async changeHomebase(
    id: number,
    homebase: Homebase,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);

    if (volunteer.homebase === homebase) {
      throw new BadRequestException(
        `Volunteer with ID ${id} is already assigned to the ${homebase} homebase`,
      );
    }

    return this.reassignCoordinators(volunteer, homebase);
  }

  /**
   * Sets a Volunteer's homebase, replaces their assigned coordinators with the
   * active coordinators there, saves, then emails the coordinators who lost and
   * gained the Volunteer.
   *
   * Emails are sent only after the save, and are best-effort: a failed send is
   * logged rather than failing the request, since the reassignment is already
   * committed. Coordinators in both the old and new lists are not emailed.
   *
   * @param volunteer - The Volunteer, with assignedCoordinators loaded.
   * @param homebase - The new homebase.
   * @returns The saved Volunteer.
   */
  private async reassignCoordinators(
    volunteer: FosterVolunteer,
    homebase: Homebase,
  ): Promise<FosterVolunteer> {
    const previous = volunteer.assignedCoordinators;
    const next = await this.coordinatorsService.findActiveByHomebase(homebase);

    volunteer.homebase = homebase;
    volunteer.assignedCoordinators = next;
    const saved = await this.repo.save(volunteer);

    const previousIds = new Set(previous.map((c) => c.coordinatorId));
    const nextIds = new Set(next.map((c) => c.coordinatorId));
    const removed = previous.filter(
      (c) => c.active && !nextIds.has(c.coordinatorId),
    );
    const added = next.filter((c) => !previousIds.has(c.coordinatorId));

    await this.notifyCoordinators(
      removed,
      coordinatorLostVolunteerEmail(saved, homebase),
      saved.volunteerId,
    );
    await this.notifyCoordinators(
      added,
      coordinatorGainedVolunteerEmail(saved),
      saved.volunteerId,
    );

    return saved;
  }

  /**
   * Sends the same email to each coordinator, logging failures without throwing
   * so one failed send does not stop the rest.
   */
  private async notifyCoordinators(
    coordinators: FosterCoordinator[],
    email: CoordinatorEmail,
    volunteerId: number,
  ): Promise<void> {
    for (const coordinator of coordinators) {
      try {
        await this.emailsService.sendEmail({
          toEmail: coordinator.email,
          ...email,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send reassignment email to coordinator ${coordinator.coordinatorId} for volunteer ${volunteerId}.`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
```

In `volunteers.module.ts` add `import { AWSSESModule } from '../aws/ses/email.module';` and `AWSSESModule,` to `imports` after `CoordinatorsModule,`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest apps/backend/src/volunteers`
Expected: PASS (service, controller, emails suites).
Run: `npx tsc -p apps/backend/tsconfig.spec.json --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/volunteers/volunteers.service.ts apps/backend/src/volunteers/volunteers.service.spec.ts apps/backend/src/volunteers/volunteers.module.ts
git commit -m "Add changeHomebase with coordinator reassignment and notifications

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `UpdateHomebaseDto` and `PATCH /volunteers/:id/homebase`

**Files:**
- Create: `apps/backend/src/volunteers/dtos/update-homebase.dto.ts`
- Modify: `apps/backend/src/volunteers/volunteers.controller.ts`
- Test: `apps/backend/src/volunteers/volunteers.controller.spec.ts`

**Interfaces:**
- Consumes: `VolunteersService.changeHomebase(id, homebase)` (Task 5).
- Produces: `UpdateHomebaseDto { homebase: Homebase }`; `VolunteersController.updateHomebase(id: number, dto: UpdateHomebaseDto): Promise<FosterVolunteer>`.

- [ ] **Step 1: Write the failing tests**

In `volunteers.controller.spec.ts` add imports:

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateHomebaseDto } from './dtos/update-homebase.dto';
```

Add `changeHomebase: jest.Mock;` to the `volunteersService` type and `changeHomebase: jest.fn(),` to its initialiser.

Add at the end of the top-level `describe`:

```ts
  describe('updateHomebase', () => {
    it('changes the homebase through the service and returns the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        homebase: Homebase.SALEM,
        assignedCoordinators: [],
      } as FosterVolunteer;
      volunteersService.changeHomebase.mockResolvedValue(volunteer);

      const result = await controller.updateHomebase(1, {
        homebase: Homebase.SALEM,
      } as UpdateHomebaseDto);

      expect(volunteersService.changeHomebase).toHaveBeenCalledTimes(1);
      expect(volunteersService.changeHomebase).toHaveBeenCalledWith(
        1,
        Homebase.SALEM,
      );
      expect(result).toBe(volunteer);
    });

    it('propagates errors thrown by the service', async () => {
      const error = new NotFoundException('Volunteer with ID 1 not found');
      volunteersService.changeHomebase.mockRejectedValue(error);

      await expect(
        controller.updateHomebase(1, {
          homebase: Homebase.SALEM,
        } as UpdateHomebaseDto),
      ).rejects.toBe(error);
      expect(volunteersService.changeHomebase).toHaveBeenCalledTimes(1);
    });
  });

  describe('UpdateHomebaseDto validation', () => {
    const errorsFor = (body: object) =>
      validate(plainToInstance(UpdateHomebaseDto, body));

    it.each(Object.values(Homebase))('accepts %p', async (homebase) => {
      expect(await errorsFor({ homebase })).toHaveLength(0);
    });

    it.each(['Narnia', 'boston', ' Boston', '', 42, null])(
      'rejects %p',
      async (homebase) => {
        const errors = await errorsFor({ homebase });

        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('homebase');
      },
    );

    it('rejects a missing homebase', async () => {
      const errors = await errorsFor({});

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('homebase');
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest apps/backend/src/volunteers/volunteers.controller.spec.ts`
Expected: FAIL — `Cannot find module './dtos/update-homebase.dto'`.

- [ ] **Step 3: Implement the DTO**

Create `apps/backend/src/volunteers/dtos/update-homebase.dto.ts`:

```ts
import { IsEnum } from 'class-validator';
import { Homebase } from '../../types';

export class UpdateHomebaseDto {
  @IsEnum(Homebase)
  homebase!: Homebase;
}
```

- [ ] **Step 4: Implement the route**

In `volunteers.controller.ts` add `import { UpdateHomebaseDto } from './dtos/update-homebase.dto';` and, after `reactivate`:

```ts
  @ApiOperation({
    summary:
      "Change a foster volunteer's homebase and reassign their coordinators",
  })
  @ApiParam({ name: 'id', type: Number, description: 'Volunteer ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'The homebase was changed and the volunteer was reassigned to its coordinators',
    type: FosterVolunteer,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'The homebase is missing, invalid, or the same as the current homebase',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No volunteer exists with the ID',
  })
  @Patch('/:id/homebase')
  async updateHomebase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHomebaseDto,
  ): Promise<FosterVolunteer> {
    validateId(id, 'Volunteer');
    return this.volunteersService.changeHomebase(id, dto.homebase);
  }
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest apps/backend/src/volunteers`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/volunteers/dtos/update-homebase.dto.ts apps/backend/src/volunteers/volunteers.controller.ts apps/backend/src/volunteers/volunteers.controller.spec.ts
git commit -m "Add PATCH /volunteers/:id/homebase endpoint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Merge `origin/main` (MSPCA-2) and route general updates through reassignment

`origin/main` contains MSPCA-2 (`GET /volunteers/:volunteerId`, `PATCH /volunteers/:volunteerId`, `UpdateVolunteerDto` in `volunteers/dto/`). Merging conflicts in `volunteers.controller.ts`, `volunteers.service.ts`, and both their specs; every conflict is "keep both sides" except the spec setup.

**Files:**
- Modify (merge): `apps/backend/src/volunteers/volunteers.controller.ts`, `volunteers.service.ts`, `volunteers.controller.spec.ts`, `volunteers.service.spec.ts`
- Modify: `apps/backend/src/volunteers/volunteers.service.ts` (`updateVolunteerById`)

**Interfaces:**
- Consumes: private `reassignCoordinators(volunteer, homebase)` (Task 5); MSPCA-2's `updateVolunteerById(id: number, dto: UpdateVolunteerDto): Promise<FosterVolunteer>` and `getVolunteerById(id)`.
- Produces: `updateVolunteerById` that reassigns coordinators when `dto.homebase` is present and different.

- [ ] **Step 1: Merge**

```bash
git fetch origin
git merge origin/main
```

Expected: conflicts in the four files above.

- [ ] **Step 2: Resolve conflicts**

- `volunteers.service.ts`: keep both import sets (this branch's `VolunteerStatus`, `CreateVolunteerDto`, Cognito, coordinators, emails imports **and** main's `import { UpdateVolunteerDto } from './dto/update-volunteer.dto';`). Keep this branch's `findActiveOrFail` (uses `status`, not `active`). Keep main's `getVolunteerById` and `updateVolunteerById`.
- `volunteers.controller.ts`: keep the union of `@nestjs/common` imports (`BadRequestException`, `Body`, `Controller`, `Get`, `HttpStatus`, `Param`, `ParseIntPipe`, `Patch`, `Post`) and both DTO imports; keep **all** routes — `create`, `getVolunteerMatches`, `getVolunteerById`, `updateVolunteerById`, `deactivate`, `reactivate`, `updateHomebase`. Route order does not matter for Nest here: `/:id/homebase`, `/:id/deactivate`, `/:id/reactivate` have two segments and cannot collide with `/:volunteerId`.
- `volunteers.service.spec.ts`: use this branch's single `repo` mock (`findOne`, `findOneBy`, `save`, `delete`) and providers (`CognitoService`, `CoordinatorsService`, `EmailsService`). Move main's `mockVolunteer` fixture and its `getVolunteerById`/`updateVolunteerById` tests in, renaming `mockRepo` → `repo` and changing `assignedCoordinator: null` → `assignedCoordinators: []`. Main's tests that used `active` must use `status: VolunteerStatus.ACTIVE` instead.
- `volunteers.controller.spec.ts`: one `volunteersService` mock containing every method from both sides (`create`, `findByIdOrFail`, `deactivate`, `reactivate`, `changeHomebase`, `getVolunteerById`, `updateVolunteerById`); keep every `describe` from both sides.

Run: `git diff --name-only --diff-filter=U`
Expected: no output (no unresolved files).

- [ ] **Step 3: Write the failing tests for `updateVolunteerById` homebase handling**

Add to `describe('updateVolunteerById')` in `volunteers.service.spec.ts` (add the `describe` if main named it differently — match main's name):

```ts
    it('reassigns coordinators and sends emails when the homebase changes', async () => {
      const oldCoordinator = {
        coordinatorId: 1,
        email: 'old1@example.com',
        active: true,
      } as FosterCoordinator;
      const newCoordinator = {
        coordinatorId: 3,
        email: 'new3@example.com',
        active: true,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue({
        volunteerId: 9,
        firstName: 'Ada',
        lastName: 'Lovelace',
        homebase: Homebase.BOSTON,
        assignedCoordinators: [oldCoordinator],
      } as FosterVolunteer);
      coordinatorsService.findActiveByHomebase.mockResolvedValue([
        newCoordinator,
      ]);
      repo.save.mockImplementation(async (volunteer) => volunteer);
      emailsService.sendEmail.mockResolvedValue(undefined);

      const result = await service.updateVolunteerById(9, {
        homebase: Homebase.SALEM,
        notes: 'Moved north',
      } as UpdateVolunteerDto);

      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledTimes(1);
      expect(coordinatorsService.findActiveByHomebase).toHaveBeenCalledWith(
        Homebase.SALEM,
      );
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          homebase: Homebase.SALEM,
          notes: 'Moved north',
          assignedCoordinators: [newCoordinator],
        }),
      );
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(2);
      expect(result.assignedCoordinators).toEqual([newCoordinator]);
    });

    it('does not reassign or email when the homebase is unchanged', async () => {
      const coordinator = {
        coordinatorId: 1,
        email: 'c1@example.com',
        active: true,
      } as FosterCoordinator;
      repo.findOne.mockResolvedValue({
        volunteerId: 9,
        homebase: Homebase.BOSTON,
        assignedCoordinators: [coordinator],
      } as FosterVolunteer);
      repo.save.mockImplementation(async (volunteer) => volunteer);

      const result = await service.updateVolunteerById(9, {
        homebase: Homebase.BOSTON,
        notes: 'Same place',
      } as UpdateVolunteerDto);

      expect(coordinatorsService.findActiveByHomebase).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result.notes).toBe('Same place');
      expect(result.assignedCoordinators).toEqual([coordinator]);
    });

    it('does not reassign or email when the homebase is not in the update', async () => {
      repo.findOne.mockResolvedValue({
        volunteerId: 9,
        homebase: Homebase.BOSTON,
        assignedCoordinators: [],
      } as FosterVolunteer);
      repo.save.mockImplementation(async (volunteer) => volunteer);

      await service.updateVolunteerById(9, {
        notes: 'Just notes',
      } as UpdateVolunteerDto);

      expect(coordinatorsService.findActiveByHomebase).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
```

Ensure `UpdateVolunteerDto` is imported in the spec from `./dto/update-volunteer.dto`.

- [ ] **Step 4: Run to verify the first new test fails**

Run: `npx jest apps/backend/src/volunteers/volunteers.service.spec.ts -t "updateVolunteerById"`
Expected: FAIL on "reassigns coordinators and sends emails when the homebase changes" (`findActiveByHomebase` called 0 times).

- [ ] **Step 5: Implement**

Replace main's `updateVolunteerById` body (keep its JSDoc, adding the homebase sentence):

```ts
  /**
   * Updates a foster volunteer by ID.
   * Only the fields included in the DTO are changed; all other fields keep their current values.
   * Changing the homebase reassigns the volunteer's coordinators and emails them,
   * the same as changeHomebase; an unchanged homebase is left alone.
   * @param id - ID of the volunteer to update
   * @param dto - The fields to update
   * @returns The updated volunteer
   * @throws NotFoundException if no volunteer exists with the given ID
   */
  async updateVolunteerById(
    id: number,
    dto: UpdateVolunteerDto,
  ): Promise<FosterVolunteer> {
    const volunteer = await this.findByIdOrFail(id);
    const { homebase, ...fields } = dto;
    Object.assign(volunteer, fields);

    if (homebase !== undefined && homebase !== volunteer.homebase) {
      return this.reassignCoordinators(volunteer, homebase);
    }

    return this.repo.save(volunteer);
  }
```

- [ ] **Step 6: Run the full backend suite and typecheck**

Run: `npx jest apps/backend`
Expected: PASS.
Run: `npx tsc -p apps/backend/tsconfig.spec.json --noEmit`
Expected: no output.

- [ ] **Step 7: Commit the merge**

```bash
git add apps/backend/src/volunteers
git commit -m "Merge main into MSPCA-27 and reassign coordinators on general homebase updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Lint and format**

Run: `npx eslint apps/backend/src`
Expected: no errors.
Run: `npx prettier --check apps/backend/src`
Expected: "All matched files use Prettier code style!" — if not, run `npx prettier --write` on the listed files and commit `"formatting"`.

- [ ] **Step 2: Full test suite**

Run: `npx jest apps/backend`
Expected: all suites pass; note the final test count in the PR.

- [ ] **Step 3: Migration round-trip against a local database** (skip and say so in the PR if no local Postgres is configured in `.env`)

Before migrating, seed one volunteer with `assigned_coordinator_id` set and one with it `NULL`. Then:

Run: `yarn typeorm:migrate`
Expected: `ReplaceAssignedCoordinatorWithJoinTable1791100000000` executes.
Check: `SELECT * FROM volunteer_coordinator_assignments;` → exactly one row, for the seeded volunteer with a coordinator.
Add a second assignment row for that volunteer with a higher `coordinator_id`.
Run: `yarn typeorm:revert`
Expected: migration reverts; `assigned_coordinator_id` holds the **lower** coordinator ID; the `NULL` volunteer is still `NULL`; `volunteer_coordinator_assignments` no longer exists.
Run: `yarn typeorm:migrate` again to leave the DB on the latest schema.

- [ ] **Step 4: Manual endpoint check** (optional, requires running the app)

`PATCH /volunteers/<id>/homebase` with `{"homebase":"Salem"}` → 200 with `assignedCoordinators`; repeat the same body → 400 with the same-homebase message; `{"homebase":"Narnia"}` → 400; unknown id → 404.

- [ ] **Step 5: Prepare the PR description** (do not open the PR without the user's go-ahead)

Must include a **Decisions open to review** section:
- Assigned coordinators stored in a `volunteer_coordinator_assignments` many-to-many join table rather than an `int[]` column (Dalton's call), so FKs are enforced.
- `homebase` kept in `UpdateVolunteerDto`.
- `PATCH /volunteers/:id` with a changed `homebase` runs the same reassignment + emails as `PATCH /volunteers/:id/homebase`; an unchanged homebase there is a no-op, not a 400.

Also list: active coordinators only; emails best-effort after save; one email per coordinator; `notifyCoordinators` in matches now emails every assigned coordinator; coordinator-side changes don't resync volunteers (follow-up). End the description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
