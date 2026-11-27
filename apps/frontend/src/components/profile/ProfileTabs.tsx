import { Box, Button, Flex } from '@chakra-ui/react';

export type ProfileTab = 'dashboard' | 'information';

// `mobileLabel` is the shorter label shown on small screens.
const TABS: { value: ProfileTab; label: string; mobileLabel?: string }[] = [
  { value: 'dashboard', label: 'Foster Dashboard' },
  {
    value: 'information',
    label: 'Information & Settings',
    mobileLabel: 'Info & Settings',
  },
];

interface ProfileTabsProps {
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}

/** Pill switcher between the Volunteer Profile's two tabs. */
const ProfileTabs: React.FC<ProfileTabsProps> = ({ value, onChange }) => (
  <Flex
    role="tablist"
    w="full"
    maxW={{ base: '80', lg: '504px' }}
    h="7"
    bg="gray.200"
    borderRadius={{ base: 'lg', lg: 'md' }}
  >
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
          borderRadius={{ base: 'lg', lg: 'md' }}
          fontSize={{ base: '10px', lg: '16px' }}
          fontWeight="semibold"
          lineHeight={{ base: '16px', lg: '24px' }}
          onClick={() => onChange(tab.value)}
        >
          {tab.mobileLabel ? (
            <>
              <Box as="span" hideFrom="lg">
                {tab.mobileLabel}
              </Box>
              <Box as="span" hideBelow="lg">
                {tab.label}
              </Box>
            </>
          ) : (
            tab.label
          )}
        </Button>
      );
    })}
  </Flex>
);

export default ProfileTabs;
