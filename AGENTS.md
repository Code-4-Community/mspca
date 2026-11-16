# AGENTS.md

Conventions for AI coding agents (Claude Code, Codex, etc.) working in this repo.

## Commands

- `yarn test`: backend Jest suite
- `yarn lint:check` / `yarn lint`: check / fix lint
- `yarn format:check` / `yarn format`: check / fix formatting
- `nx serve backend`, `nx serve frontend`: run the apps

Run `yarn test`, `yarn lint:check`, and `yarn format:check` before considering a change done.

## Git and PRs

- Name branches `<initials>/mspca-<n>-<short-description>`, e.g. `jw/mspca-51-navbar`.
- Reference the Jira ticket (`MSPCA-<n>`) in commit messages and PR titles, and follow `.github/pull_request_template.md` for PR descriptions.
- Use the `gh` CLI with `--repo Code-4-Community/mspca`. Without it, `gh` targets the upstream scaffolding repo.
- Only touch what the ticket covers. Don't reformat or rewrite unrelated code or tests, and merge `main` in so the diff stays clean.
- Don't change `package.json` or `yarn.lock` unless the ticket needs a new dependency.
- Never commit `.env` files, credentials, or other secrets. Add new environment variables to `example.env` with placeholder values.
- Register new modules in `AppModule`.

## Testing scope

- Write specs for backend code that has logic: controllers, services, utils, custom decorators and validators, guards, config, and modules with startup checks (`onModuleInit`).
- On the frontend, only unit-test pure util functions (e.g. `utils/animals.spec.ts` next to `utils/animals.ts`). Don't write component, page, or app tests.
- Don't test DTOs or class-validator decorators. They come from a trusted library, so assume they work.
- Test custom validators and decorators (e.g. `@IsNonEmptyString`, `@AtLeastOneValue`) once, in their own spec file. After that, assume they work and don't re-test their logic in the controllers or services that use them.
- Don't write tests for `validateId` or `ParseIntPipe`. `validateId` is covered once in `utils/validation.utils.spec.ts`, so skip per-endpoint "throws BadRequestException when id is invalid" cases.
- Don't test email body template functions, entities, or wiring-only modules. Don't re-test a helper that already has its own tests (e.g. `escapeHtml`).

## Test conventions

- Never change a test's assertions or delete a test just to make it pass. Fix the code, or ask the developer if the test itself looks wrong.
- Pair every `toHaveBeenCalledWith` on a mock with `toHaveBeenCalledTimes(n)`. In failure tests, also assert the calls made before the failure.
- Assert what didn't happen on early failures, e.g. `expect(cognitoService.addUserToGroup).not.toHaveBeenCalled()`, or that the logger wasn't called on success.
- Happy-path tests check the return value, that `save` was called with the expected fields, and that the lookup was called with the right ID.
- Always assert the exact error, not just its class: `rejects.toThrow(new NotFoundException('Volunteer with id 5 not found'))`.
- Controller specs cover the happy path plus one "propagates errors thrown by the service" test per endpoint. Specific error cases belong in service specs.
- When a service calls a helper that's already tested (e.g. `findActiveOrFail`), only assert that it was called with the right arguments.
- One test per rule: don't repeat a test for every status value, and combine tests that share the same mock.
- Include data that should be filtered out (a match for a different animal, an inactive coordinator, another homebase) so the test proves the filter works.
- Declare fixtures as module-level constants typed with `as`, e.g. `as CreateMatchDto`, `as FosterVolunteer`, `as Match[]`. Because `as` hides missing required fields, update fixtures when a DTO or entity changes.
- Mock dependencies with hand-typed objects passed through `useValue`, e.g. `let repo: { save: jest.Mock; findOneBy: jest.Mock }`, and use `getRepositoryToken(Entity)` for repositories. Don't add a mocking library.
- Set mock return values inside each test, not as shared defaults in `beforeEach`. Reset mocks in `beforeEach`.
- For AWS SDK calls, assert the call count and each call's command class and `.input`, including cleanup commands (e.g. `AdminDeleteUserCommand`).
- If a spec changes `process.env`, save the original value and restore it afterwards.
- Name tests in the present tense without "should": `it('returns the match')`.

## Comments

- Don't add comments other than docstrings and `TODO(MSPCA-<n>)` notes.
- The one exception is a single-line comment explaining _why_ for a workaround or a deliberately unusual choice. Never write comments that narrate what the code does.
- When unsure, leave the comment out.

## Controllers

- Put the HTTP method decorator (`@Get`, `@Post`, `@Patch`, ...) first, above all other decorators.
- Document every endpoint for Swagger with specific, endpoint-level descriptions: `@ApiOperation({ summary, description })`, `@ApiParam({ name, type, description })` for each route param, and an `@ApiResponse({ status, description, type })` for the success case and for each error the service can throw.
- Give every handler an explicit return type, e.g. `Promise<FosterVolunteer>`.
- Use `HttpStatus.X`, never raw numbers. POST returns `CREATED`, and endpoints that return nothing use `NO_CONTENT`.
- Parse numeric route params with `@Param('id', ParseIntPipe) id: number`, then call `validateId(id, 'Entity')`.
- Controllers validate input only. Existence checks and business rules go in the service. Don't add a separate existence check when the service fetches the entity anyway.
- Mark endpoints that must be reachable without login (sign-up, confirm) with `@Public()`.
- Controllers don't get JSDoc. The Swagger decorators are their documentation.

## Services

- Every public service and util function gets a JSDoc docstring: a one-line summary, then any business rules or edge cases the signature can't show; `@param name - description` per parameter; `@returns` (for `void`, "A promise that resolves when … is complete"); and one `@throws {ExceptionClass} If …` per error case, noting side effects such as cleanup on failure.
- Update the docstring whenever the behavior, params, or thrown errors change.
- Don't write inline comments in services. Put the explanation in the docstring instead (see Comments for the one exception).
- Give every function an explicit return type, e.g. `Promise<FosterVolunteer>`.
- Reuse the existing lookup helpers (`findByIdOrFail`, `findActiveOrFail`, etc.) instead of writing new lookup-and-throw code.
- Throw `NotFoundException` for a missing entity looked up by ID (`Volunteer with id 5 not found`) and `ConflictException` for state conflicts (e.g. approving a match that isn't pending).
- Throw `BadRequestException` for invalid input. That covers input with the wrong type or shape, and input that's well-formed but invalid against the database (e.g. removing a preference the volunteer doesn't have, or adding one they already have).
- Never put Cognito or other AWS error details in exception messages that reach the client.
- Use `try { } catch { }` blocks for error handling, not `.catch()` chains.
- Log the raw error, not `error.stack`. Write log messages in a fixed shape that's easy to search, e.g. `Volunteer: { volunteerId: 5, email: ... } was deleted from Cognito but not from database`.
- Don't trim or lowercase input in services. DTO transforms already do that.
- Run independent awaits together with `Promise.all`. Wrap multi-step writes that must succeed or fail together in a transaction.
- Avoid O(n) lookups inside loops (`includes`, `find`, `filter`, `indexOf`). Build a `Set` or `Map` first so each lookup is constant time.
- Delete commented-out code.

## Emails

- Each email template lives in its module's `emails/` folder (e.g. `volunteers/emails/volunteerApproved.ts`) and exports a function that returns `EmailContent` (`{ subject, bodyHtml }`) from `utils/emails.utils.ts`.
- Pass every user-provided value in a template through `escapeHtml`.
- Send with `emailsService.sendEmail({ toEmail, ...template(...) })`.
- To email several people, send to `AWS_SES_SENDER_EMAIL` and put the recipients in `bccEmails`, in batches of 50 per email (the SES limit). When coordinators should see each other, use `ccEmails` instead.
- Wrap each send in `try`/`catch` and log failures. A failed email never fails the main operation, and a failed batch doesn't stop the remaining batches.

## DTOs

- DTOs live in a `dtos/` folder inside their module. DTOs shared across modules go in `utils/dtos/`.
- Strings use `@IsNonEmptyString()`.
- Optional fields use `@ValidateIf((_, value) => value !== undefined)` instead of `@IsOptional()`. Add `&& value !== null` when the database column is nullable.
- When every field is optional but at least one must be sent (e.g. PATCH bodies), decorate the class with `@AtLeastOneValue<Dto>(['fieldA', 'fieldB'])` from `volunteers/dtos/validators/at-least-one-value.validator.ts`. Don't re-check "no fields provided" in the controller or service. `null` counts as provided, so each field's own decorators decide whether `null` is allowed. Pass array field names as the third argument when an empty array should count as provided.
- Give every string a `@MaxLength` matching its entity column, except emails and `@IsPhoneNumber('US')` fields. Emails use `@IsEmail()` without `@IsString()`.
- Arrays get `@ArrayUnique()` and `@ArrayNotEmpty()`.
- Don't repeat IDs from the route in the body.

## Migrations and entities

- Always add a new migration. Never edit one that has already been merged, since it won't re-run for anyone who already ran it.
- Create migrations with `yarn typeorm:create apps/backend/src/migrations/<MigrationName>` so the file gets a correct timestamp, and check that the timestamp doesn't match one in another open PR.
- Register each migration in `apps/backend/src/config/migrations.ts`.
- Combine related `ALTER`s into one `queryRunner.query`.
- Make sure `down` actually reverts `up`, and test both.
- When a migration drops or changes a column or enum value that existing rows may still use (e.g. removing a `FosterType` value that some volunteers have), stop and ask the developer how to handle that data before writing it. The answer is case by case.
- Put unique constraints on the column: `@Column({ unique: true })`.

## Frontend

- Use Chakra theme tokens (`textStyle="body-small"`, `h7`, `xs`, colors from `theme.ts`) instead of raw values, and match Figma exactly.
- Use `lucide-react` for icons and plain Chakra components (e.g. `Button`) over custom ones.
- Shared TS interfaces go in `apps/frontend/src/types.ts` and must match the backend entities.
- Modals go in `components/modals/`.
- Give each component and page a JSDoc docstring above it explaining what it does and where it's used. This is the only documentation frontend files need.
- Every data fetch handles loading and error states: fetch in a `try`/`catch`, show a loading state while it's pending, and set an error state the UI displays on failure.
- Use enums and `Record<Enum, ...>` maps instead of string lists or repeated getters.
- Filter options come from predefined consts, not from whatever data is loaded.
