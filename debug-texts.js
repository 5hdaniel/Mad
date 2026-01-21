const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const os = require('os');

// Find the database
const dbPath = path.join(os.homedir(), 'Library/Application Support/magic-audit/magic-audit.db');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });

  // Get a sample transaction ID
  const txn = db.prepare('SELECT id, property_address FROM transactions LIMIT 1').get();
  if (!txn) {
    console.log('No transactions found');
    process.exit(1);
  }
  console.log('\nTransaction:', txn.property_address);
  console.log('ID:', txn.id);

  // Count communications by type
  const counts = db.prepare(`
    SELECT communication_type, COUNT(*) as count
    FROM communications
    WHERE transaction_id = ?
    GROUP BY communication_type
  `).all(txn.id);
  console.log('\nCommunications by type:');
  counts.forEach(c => console.log('  ' + c.communication_type + ': ' + c.count));

  // Check thread_ids for texts
  const threads = db.prepare(`
    SELECT DISTINCT thread_id, COUNT(*) as count
    FROM communications
    WHERE transaction_id = ? AND communication_type = 'text'
    GROUP BY thread_id
  `).all(txn.id);
  console.log('\nText threads in communications table:');
  threads.forEach(t => console.log('  ' + t.thread_id + ': ' + t.count + ' records'));

  // Check messages table for these threads
  if (threads.length > 0) {
    const threadIds = threads.map(t => t.thread_id).filter(Boolean);
    console.log('\nThread IDs found:', threadIds.length);

    if (threadIds.length > 0) {
      const placeholders = threadIds.map(() => '?').join(',');
      const msgCounts = db.prepare(
        'SELECT thread_id, COUNT(*) as count FROM messages WHERE thread_id IN (' + placeholders + ') GROUP BY thread_id'
      ).all(...threadIds);
      console.log('\nMessages in messages table by thread:');
      msgCounts.forEach(m => console.log('  ' + m.thread_id + ': ' + m.count + ' messages'));
    }
  }

  // Also check total messages linked to this transaction
  const totalLinked = db.prepare(`
    SELECT COUNT(*) as count FROM communications
    WHERE transaction_id = ?
  `).get(txn.id);
  console.log('\nTotal communications linked:', totalLinked.count);

  db.close();
} catch (e) {
  console.error('Error:', e.message);
  console.error(e.stack);
}
