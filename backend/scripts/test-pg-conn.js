// Quick connect test - tries a list of (user, password) pairs against local Postgres.
const { Client } = require('pg');

const candidates = [
  ['postgres', 'kalpan@2007'],
  ['postgres', 'Kalpan@2007'],
  ['postgres', 'postgres'],
  ['postgres', 'admin'],
  ['postgres', 'password'],
  ['postgres', '1234'],
  ['postgres', '12345'],
  ['KALPAN', 'kalpan@2007'],
  ['kalpan', 'kalpan@2007'],
  ['KALPAN', 'KALPAN'],
];

(async () => {
  for (const [u, p] of candidates) {
    const cs = `postgresql://${u}:${encodeURIComponent(p)}@localhost:5432/postgres`;
    const c = new Client({ connectionString: cs });
    try {
      await c.connect();
      const r = await c.query('SELECT current_user, version()');
      console.log(`OK  user=${u} password=${p} -> current_user=${r.rows[0].current_user}`);
      await c.end();
      return; // stop at first success
    } catch (e) {
      console.log(`NO  user=${u} password=${p} -> ${e.message}`);
    }
  }
  console.log('None of the candidates worked.');
})();
