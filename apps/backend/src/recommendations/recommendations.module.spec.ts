import { DynamicModule } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { RecommendationsModule } from './recommendations.module';

/**
 * Collects the entity names every TypeOrmModule.forFeature() reachable from
 * the given module registers. forFeature exposes each entity as a repository
 * provider whose token is the string `${EntityName}Repository`.
 */
function registeredEntityNames(
  mod: unknown,
  seen = new Set<unknown>(),
  found = new Set<string>(),
): Set<string> {
  if (!mod || seen.has(mod)) return found;
  seen.add(mod);

  const dynamic = mod as Partial<DynamicModule>;
  const staticModule = dynamic.module ?? mod;

  for (const provider of dynamic.providers ?? []) {
    const token = (provider as { provide?: unknown }).provide;
    if (typeof token === 'string' && token.endsWith('Repository')) {
      found.add(token.slice(0, -'Repository'.length));
    }
  }

  const imports = [
    ...((Reflect.getMetadata('imports', staticModule) as unknown[]) ?? []),
    ...(dynamic.imports ?? []),
  ];
  for (const imported of imports) registeredEntityNames(imported, seen, found);

  return found;
}

/** Resolves the entity a relation points at, e.g. `() => FosterCoordinator`. */
function relationTargetName(type: unknown): string | null {
  const resolved = typeof type === 'function' ? type(undefined) : type;
  if (typeof resolved === 'string') return resolved;
  if (typeof resolved === 'function') return resolved.name;
  return null;
}

describe('RecommendationsModule', () => {
  /**
   * `autoLoadEntities` hands TypeORM only the entities that a reachable
   * forFeature() registered. If one of them has a relation to an entity whose
   * module was never imported, TypeORM throws "Entity metadata for X#y was not
   * found" while building metadata and the app dies on boot. No other test
   * catches that, because none of them stand the module graph up.
   */
  it('registers every entity that its registered entities relate to', () => {
    const registered = registeredEntityNames(RecommendationsModule);
    expect(registered).toContain('Recommendation');

    const missing = getMetadataArgsStorage()
      .relations.filter(
        (relation) =>
          typeof relation.target === 'function' &&
          registered.has(relation.target.name),
      )
      .map((relation) => ({
        from: `${(relation.target as { name: string }).name}#${
          relation.propertyName
        }`,
        to: relationTargetName(relation.type),
      }))
      .filter(({ to }) => to !== null && !registered.has(to));

    expect(missing).toEqual([]);
  });
});
