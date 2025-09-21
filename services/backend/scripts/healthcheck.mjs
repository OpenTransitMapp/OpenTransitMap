import http from 'node:http';

const port = Number(process.env.PORT || 8080);
const options = {
  hostname: 'localhost',
  port,
  path: '/healthz',
  timeout: 5000,
};

const req = http.get(options, (res) => {
  res.resume();
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('timeout', () => {
  req.destroy(new Error('timeout'));
  process.exit(1);
});

req.on('error', () => process.exit(1));

