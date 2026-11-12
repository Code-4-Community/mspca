# AGENTS.md

Conventions for AI coding agents (Claude Code, Codex, etc.) working in this repo.

## Commands

- `yarn test`: backend Jest suite
- `yarn lint:check` / `yarn lint`: check / fix lint
- `yarn format:check` / `yarn format`: check / fix formatting
- `nx serve backend`, `nx serve frontend`: run the apps

Run `yarn test`, `yarn lint:check`, and `yarn format:check` before considering a change done.

## Testing scope

- Write specs for backend code that has logic: controllers, services, utils, decorators, guards, config, and modules with startup checks (`onModuleInit`).
- Don't write specs for files that only wire things together (entities, DTOs, modules with no logic of their own). DTO validation is tested in a `describe('XDto validation')` block in the controller spec.
- Don't add frontend tests beyond the existing `apps/frontend/src/app.spec.tsx` smoke test.
- Don't write tests for `validateId`. It's covered once in `utils/validation.utils.spec.ts`, so skip per-endpoint "throws BadRequestException when id is invalid" cases. The same goes for `ParseIntPipe` and other shared validation.

## Test conventions

- Pair every `toHaveBeenCalledWith` on a mock with `toHaveBeenCalledTimes(n)`. In failure tests, also assert the calls made before the failure.
- When a function can throw the same exception class for different reasons, assert the exact error: `rejects.toThrow(new NotFoundException('...'))`, not just the class.
- Controller specs cover the happy path plus one "propagates errors thrown by the service" test per endpoint. Specific error cases belong in service specs.
- DTO validation tests go in their own `describe('XDto validation')` block, using `plainToInstance` + `validate` and asserting on `errors[0].property`.
- Declare fixtures as module-level constants typed with `as`, e.g. `as CreateMatchDto` or `as FosterVolunteer`. Because `as` hides missing required fields, update fixtures when a DTO or entity changes.
- Mock dependencies with hand-typed objects passed through `useValue`, e.g. `let repo: { save: jest.Mock; findOneBy: jest.Mock }`, and use `getRepositoryToken(Entity)` for repositories. Don't add a mocking library.
- For AWS SDK calls, assert the call count and each call's command class and `.input`, including cleanup commands (e.g. `AdminDeleteUserCommand`).
- Reset mocks in `beforeEach`. If a spec changes `process.env`, save the original value and restore it afterwards.
- Name tests in the present tense without "should": `it('returns the match')`.

## Comments

- Don't add comments that restate what the code already makes obvious.
- Only comment on what the code can't say for itself: a non-obvious reason, a workaround, a constraint, or a TODO with a ticket number.
- Keep inline comments (anything other than a function or class docblock) short and to the point, ideally one line.
- When unsure, leave the comment out.

## Docstrings

- Every public service and util function gets a JSDoc block: a one-line summary, then any business rules the signature can't show; `@param name - description` per parameter; `@returns` (for `void`, "A promise that resolves when … is complete"); and one `@throws {ExceptionClass} If …` per error case, noting side effects such as cleanup on failure.
- Update the docblock whenever the behavior, params, or thrown errors change.
- Controllers don't get JSDoc. Document endpoints with `@ApiOperation({ summary })` and an `@ApiResponse` for each status code.
- These docblocks are the exception to the comment rules above.

## Other conventions

- Use the `gh` CLI with `--repo Code-4-Community/mspca`. Without it, `gh` targets the upstream scaffolding repo.
- Follow `.github/pull_request_template.md` for PR descriptions, and reference the Jira ticket (`MSPCA-<n>`) in branch names, commit messages, and PR titles.
