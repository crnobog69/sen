import type { ApiKey } from './db/schema.ts';

export type AppBindings = {
  Variables: {
    apiKey: ApiKey;
    admin: true;
  };
};
