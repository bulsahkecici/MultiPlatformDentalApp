// Jest manual mock for db ping
async function pingDb() {
  return true;
}
module.exports = { pingDb };
