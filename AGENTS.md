# AGENTS.md

Conventions for AI coding agents (Claude Code, Codex, etc.) working in this repo.

## Commands

- `yarn test`: backend Jest suite
- `yarn lint:check` / `yarn lint`: check / fix lint
- `yarn format:check` / `yarn format`: check / fix formatting
- `nx serve backend`, `nx serve frontend`: run the apps

Run `yarn test`, `yarn lint:check`, and `yarn format:check` before considering a change done.

## PR scope

- Only touch what the ticket covers. Don't reformat or rewrite unrelated code or tests, and merge `main` in so the diff stays clean.
- Don't change `package.json` or `yarn.lock` unless the ticket needs a new dependency.
- Register new modules in `AppModule`.

## Testing scope

- Write specs for backend code that has logic: controllers, services, utils, custom decorators and validators, guards, config, and modules with startup checks (`onModuleInit`).
- On the frontend, only unit-test pure util functions (e.g. `utils/animals.spec.ts` next to `utils/animals.ts`). Don't write component or page tests beyond the existing `app.spec.tsx` smoke test.
- Don't test DTOs or class-validator decorators. They come from a trusted library, so assume they work. Custom validators and decorators do get tests.
- Don't write tests for `validateId` or `ParseIntPipe`. `validateId` is covered once in `utils/validation.utils.spec.ts`, so skip per-endpoint "throws BadRequestException when id is invalid" cases.
- Don't test email body template functions, entities, or wiring-only modules. Don't re-test a helper that already has its own tests (e.g. `escapeHtml`).

## Test conventions

- Pair every `toHaveBeenCalledWith` on a mock with `toHaveBeenCalledTimes(n)`. In failure tests, also assert the calls made before the failure.
- Assert what didn't happen on early failures, e.g. `expect(cognitoService.addUserToGroup).not.toHaveBeenCalled()`, or that the logger wasn't called on success.
- Happy-path tests check the return value, that `save` was called with the expected fields, and that the lookup was called with the right ID.
- When a function can throw the same exception class for different reasons, assert the exact error: `rejects.toThrow(new NotFoundException('...'))`, not just the class.
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

## Controllers

- Put the HTTP method decorator (`@Get`, `@Post`, `@Patch`, ...) first, above all other decorators.
- Document every endpoint for Swagger: `@ApiOperation({ summary })`, `@ApiParam` for route params, and an `@ApiResponse` for the success case and for each error the service can throw.
- Use `HttpStatus.X`, never raw numbers. POST returns `CREATED`, and endpoints that return nothing use `NO_CONTENT`.
- Parse numeric route params with `@Param('id', ParseIntPipe) id: number`, then call `validateId(id, 'Entity')`.
- Controllers validate input only. Existence checks and business rules go in the service. Don't add a separate existence check when the service fetches the entity anyway.
- Mark endpoints that must be reachable without login (sign-up, confirm) with `@Public()`.

## Services

- Give every function an explicit return type, e.g. `Promise<FosterVolunteer>`.
- Reuse the existing lookup helpers (`findByIdOrFail`, `findActiveOrFail`, etc.) instead of writing new lookup-and-throw code.
- Throw `NotFoundException` for missing entities (`Volunteer with id 5 not found`), `ConflictException` for state conflicts (e.g. a match that isn't pending), and `BadRequestException` for invalid input.
- Never put Cognito or other AWS error details in exception messages that reach the client.
- Use `try { } catch { }` blocks for error handling, not `.catch()` chains.
- Log the raw error, not `error.stack`. Write log messages in a fixed shape that's easy to search, e.g. `Volunteer: { volunteerId: 5, email: ... } was deleted from Cognito but not from database`.
- When an email fails to send, log it and don't throw. The main operation should still succeed. SES allows at most 50 recipients per email, so send in batches.
- Run independent awaits together with `Promise.all`. Wrap multi-step writes that must succeed or fail together in a transaction.
- Use a `Set` for membership checks inside loops.
- Delete commented-out code and step-by-step narration comments.

## DTOs

- DTOs live in a `dtos/` folder inside their module. DTOs shared across modules go in `utils/dtos/`.
- Strings use `@IsNonEmptyString()`.
- Optional fields use `@ValidateIf((_, value) => value !== undefined)` instead of `@IsOptional()`. Add `&& value !== null` when the database column is nullable.
- Give every string a `@MaxLength` matching its entity column, except emails and `@IsPhoneNumber('US')` fields. Emails use `@IsEmail()` without `@IsString()`.
- Arrays get `@ArrayUnique()` and `@ArrayNotEmpty()`.
- Trim and lowercase in DTO transforms, not in the service.
- Don't repeat IDs from the route in the body.

## Migrations and entities

- Always add a new migration. Never edit one that has already been merged, since it won't re-run for anyone who already ran it.
- Register each migration in `apps/backend/src/config/migrations.ts`.
- Combine related `ALTER`s into one `queryRunner.query`.
- Make sure `down` actually reverts `up`, and test both.
- Check that a new migration's timestamp doesn't match one in another open PR.
- Put unique constraints on the column: `@Column({ unique: true })`.

## Frontend

- Use Chakra theme tokens (`textStyle="body-small"`, `h7`, `xs`, colors from `theme.ts`) instead of raw values, and match Figma exactly.
- Use `lucide-react` for icons and plain Chakra components (e.g. `Button`) over custom ones.
- Shared TS interfaces go in `apps/frontend/src/types.ts` and must match the backend entities.
- Modals go in `components/modals/`.
- Start each component and page file with a short comment explaining what it does and where it's used.
- Use enums and `Record<Enum, ...>` maps instead of string lists or repeated getters.
- Filter options come from predefined consts, not from whatever data is loaded.

## Comments

- Don't add comments that restate what the code already makes obvious.
- Only comment on what the code can't say for itself: a non-obvious reason, a workaround, a constraint, or a TODO with a ticket number.
- Keep inline comments (anything other than a function or class docblock) short and to the point, ideally one line.
- When unsure, leave the comment out.

## Docstrings

- Every public service and util function gets a JSDoc block: a one-line summary, then any business rules the signature can't show; `@param name - description` per parameter; `@returns` (for `void`, "A promise that resolves when … is complete"); and one `@throws {ExceptionClass} If …` per error case, noting side effects such as cleanup on failure.
- Update the docblock whenever the behavior, params, or thrown errors change.
- Controllers don't get JSDoc. Document endpoints with Swagger decorators (see Controllers).
- These docblocks and the frontend file-header comments are the exception to the comment rules above.

## Other conventions

- Use the `gh` CLI with `--repo Code-4-Community/mspca`. Without it, `gh` targets the upstream scaffolding repo.
- Follow `.github/pull_request_template.md` for PR descriptions, and reference the Jira ticket (`MSPCA-<n>`) in branch names, commit messages, and PR titles.
