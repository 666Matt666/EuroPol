const bcrypt = require('bcryptjs');

const usersToCreate = [
  { email: 'adm@europol.com', pass: 'adm', role_id: 3, empresa_id: 1 },
  { email: 'sup@europol.com', pass: 'sup', role_id: 2, empresa_id: 1 },
  { email: 'ope@europol.com', pass: 'ope', role_id: 1, empresa_id: 2 },
];

console.log('-- Copia y pega estas líneas en tu archivo init.sql, reemplazando el INSERT INTO usuarios existente:');
console.log('-- Hashes generados localmente para asegurar la correspondencia.');
console.log("INSERT INTO usuarios (email, password_hash, status, role_id, empresa_id) VALUES");

const values = usersToCreate.map(user => {
  const hash = bcrypt.hashSync(user.pass, 10);
  return `('${user.email}', '${hash}', 'activo', ${user.role_id}, ${user.empresa_id})`;
});

console.log(values.join(',\n') + ';');