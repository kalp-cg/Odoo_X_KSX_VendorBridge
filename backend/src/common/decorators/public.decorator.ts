import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'vb:public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
