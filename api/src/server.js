const app = require('./index');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`Rephrase API listening on port ${env.port}`);
});
