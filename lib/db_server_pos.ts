import mysql from 'mysql2/promise';

const poolServerPos = mysql.createPool({
  host: process.env.MYSQL_SERVER_POS_HOST || '103.127.133.167',
  port: Number(process.env.MYSQL_SERVER_POS_PORT) || 3306,
  user: process.env.MYSQL_SERVER_POS_USER || 'tlmid_pos_new',
  password: process.env.MYSQL_SERVER_POS_PASSWORD || '5Tevsoft26*',
  database: process.env.MYSQL_SERVER_POS_DATABASE || 'tlmid_pos_new',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

export default poolServerPos;
