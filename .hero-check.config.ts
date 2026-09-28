import { defineConfig } from '@playwright/test';
import config from './playwright.config';
import { frenchSaved } from './tests/locale';
export default defineConfig({...config,
  use: {...config.use,baseURL:'http://127.0.0.1:5192', storageState:frenchSaved('http://127.0.0.1:5192')},
  webServer: undefined
});
