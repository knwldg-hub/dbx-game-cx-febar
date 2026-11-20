import { createApp, analytics, genie, lakebase, server } from '@databricks/appkit';
import { setupConsoleRoutes } from './routes/console-routes';

// Two Genie spaces exposed under aliases used by <GenieChat alias="..." />.
// DATABRICKS_GENIE_SPACE_ID must stay set: AppKit validates it at startup.
const genieSpaces = {
  trust: process.env.DATABRICKS_GENIE_SPACE_ID ?? '',
  experience: process.env.DATABRICKS_GENIE_SPACE_EXPERIENCE ?? '',
};

createApp({
  plugins: [
    analytics(),
    genie({ spaces: genieSpaces }),
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    setupConsoleRoutes(appkit);
  },
}).catch(console.error);
