import { useMemo, useState, type ReactNode } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';

import type { Animal, Match } from '../../types';
import { groupMatches, type MatchWithAnimal } from '@utils/matches';
import type { ApiData } from '@utils/useApiData';
import AnimalModal from '../modals/AnimalModal';
import { ErrorState, LoadingState } from './FetchStates';
import { FosterMatchTile, PendingMatchTile } from './MatchTiles';
import PagedRow from './PagedRow';

interface FosterDashboardProps {
  matches: ApiData<Match[]>;
  animals: ApiData<Animal[]>;
}

const Section: React.FC<{
  title: string;
  emptyText: string;
  items: MatchWithAnimal[];
  pageSize: number;
  // When false, only the first `pageSize` items show, with no paging controls.
  paged?: boolean;
  renderItem: (item: MatchWithAnimal) => ReactNode;
}> = ({ title, emptyText, items, pageSize, paged = true, renderItem }) => (
  <Flex direction="column" align="flex-start" gap="6" alignSelf="stretch">
    <Text color="black" fontSize="20px" fontWeight="semibold" lineHeight="32px">
      {title}
    </Text>
    {items.length === 0 ? (
      <Text color="neutrals.grey">{emptyText}</Text>
    ) : !paged ? (
      <Flex gap="5" align="center">
        {items.slice(0, pageSize).map((item) => (
          <Box key={item.match.matchId}>{renderItem(item)}</Box>
        ))}
      </Flex>
    ) : (
      <PagedRow
        items={items}
        pageSize={pageSize}
        getKey={({ match }) => match.matchId}
        renderItem={renderItem}
      />
    )}
  </Flex>
);

/**
 * The "Foster Dashboard" tab of the Volunteer Profile: the volunteer's
 * matches grouped into Pending Applications, Current Fosters and Past
 * Fosters. Matches only carry the animal's Chameleon ID, so the animals are
 * fetched too and joined on the page. "See More" on a tile opens the same
 * `AnimalModal` as the Animal Availability page, without the Apply section.
 */
const FosterDashboard: React.FC<FosterDashboardProps> = ({
  matches,
  animals,
}) => {
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  const groups = useMemo(
    () => groupMatches(matches.data ?? [], animals.data ?? []),
    [matches.data, animals.data],
  );

  let body: ReactNode;
  if (matches.loading || animals.loading) {
    body = <LoadingState />;
  } else if (matches.notFound) {
    body = <ErrorState message="We couldn't find a volunteer with this ID." />;
  } else if (matches.error) {
    body = (
      <ErrorState
        message="Something went wrong while loading your matches."
        onRetry={matches.reload}
      />
    );
  } else if (animals.error) {
    body = (
      <ErrorState
        message="Something went wrong while loading your animals."
        onRetry={animals.reload}
      />
    );
  } else {
    body = (
      <Flex direction="column" align="flex-start" gap="9" alignSelf="stretch">
        <Section
          title="Pending Applications"
          emptyText="You have no pending applications."
          items={groups.pending}
          pageSize={2}
          paged={false}
          renderItem={({ animal }) => (
            <PendingMatchTile animal={animal} onSeeMore={setSelectedAnimal} />
          )}
        />
        <Section
          title="Current Fosters"
          emptyText="You aren't fostering any animals right now."
          items={groups.current}
          pageSize={3}
          renderItem={({ animal }) => (
            <FosterMatchTile animal={animal} onSeeMore={setSelectedAnimal} />
          )}
        />
        <Section
          title="Past Fosters"
          emptyText="You have no past fosters yet."
          items={groups.past}
          pageSize={3}
          renderItem={({ animal }) => (
            <FosterMatchTile animal={animal} onSeeMore={setSelectedAnimal} />
          )}
        />
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="flex-start" gap="6">
      <Text
        color="black"
        fontSize="24px"
        fontWeight="semibold"
        lineHeight="36px"
      >
        Dashboard
      </Text>
      {body}
      <AnimalModal
        animal={selectedAnimal}
        onClose={() => setSelectedAnimal(null)}
        canApply={false}
      />
    </Flex>
  );
};

export default FosterDashboard;
