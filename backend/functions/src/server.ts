import 'dotenv/config';
import { createApp } from './app';

const port = process.env.PORT ? Number(process.env.PORT) : 8000;

createApp().listen(port, () => {
  console.log(`Pattern Mirror API listening on http://localhost:${port}`);
});
