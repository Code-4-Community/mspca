import { Button, Flex } from '@chakra-ui/react';

export type ProfileTab = 'dashboard' | 'information';

const TABS: { value: ProfileTab; label: string }[] = [
  { value: 'dashboard', label: 'Foster Dashboard' },
  { value: 'information', label: 'Information & Settings' },
];

interface ProfileTabsProps {
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

/** Pill switcher between the Volunteer Profile's two tabs. */
const ProfileTabs: React.FC<ProfileTabsProps> = ({ value, onChange }) => (
  <Flex role="tablist" w="504px" h="7" bg="gray.200" borderRadius="md">
    {TABS.map((tab) => {
      const selected = tab.value === value;
      return (
        <Button
          key={tab.value}
          role="tab"
          aria-selected={selected}
          flex="1"
          h="full"
          minH="0"
          px="0"
          variant="plain"
          bg={selected ? 'blue.blue2' : 'transparent'}
          color={selected ? 'white' : 'neutrals.black'}
          borderRadius="md"
          fontSize="16px"
          fontWeight="semibold"
          lineHeight="24px"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </Button>
      );
    })}
  </Flex>
);

export default ProfileTabs;
