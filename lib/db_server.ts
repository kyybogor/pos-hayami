import mysql from 'mysql2/promise';

const poolServer = mysql.createPool({
  host: process.env.MYSQL_SERVER_HOST || '103.127.133.167',
  port: Number(process.env.MYSQL_SERVER_PORT) || 3306,
  user: process.env.MYSQL_SERVER_USER || 'tlmid_hayami-new',
  password: process.env.MYSQL_SERVER_PASSWORD || '5Tevsoft26*',
  database: process.env.MYSQL_SERVER_DATABASE || 'tlmid_hayami-new',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

export default poolServer;
