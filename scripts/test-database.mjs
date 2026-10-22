import assert from 'node:assert/strict';import{compileQuery}from'../lib/pg-query.mjs';
assert.deepEqual(compileQuery('SELECT * FROM members WHERE id=?'),{sql:'SELECT * FROM hsmi.members WHERE id=$1',parameterCount:1});
assert.equal(compileQuery('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').sql,'INSERT INTO hsmi.settings(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING');
assert.equal(compileQuery("SELECT '?' FROM audit WHERE detail=? AND action='It''s ?'").parameterCount,1);
assert.equal(compileQuery('SELECT * FROM members ORDER BY name COLLATE NOCASE').sql,'SELECT * FROM hsmi.members ORDER BY lower(name)');
assert.equal(compileQuery('UPDATE members SET data=? WHERE id=? AND revision=?').parameterCount,3);
console.log('PASS: consultas parametrizadas, esquema hsmi y conversión de consultas heredadas.');
