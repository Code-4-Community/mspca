import { SetMetadata } from '@nestjs/common';

// Metadata key to state that the route is PUBLIC and thus NOT PROTECTED by authentication(Cognito JWT Guard)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
