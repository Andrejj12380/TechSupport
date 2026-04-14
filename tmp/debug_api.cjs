// Check what the API actually returns
const http = require('http');

// First, login to get a token
const loginData = JSON.stringify({ username: 'admin', password: 'admin' });

const loginReq = http.request({
  hostname: 'localhost',
  port: 5002,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      console.log('Got token, fetching analytics...');
      
      const apiReq = http.request({
        hostname: 'localhost',
        port: 5002,
        path: '/api/tickets/analytics/post-implementation',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res2) => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          try {
            const data = JSON.parse(body2);
            console.log('Response keys:', Object.keys(data));
            if (data.error) {
              console.log('ERROR from server:', data.error);
              return;
            }
            console.log('lineStats rows:', data.lineStats?.length);
            console.log('categories rows:', data.categories?.length);
            console.log('categoryByLifecycle rows:', data.categoryByLifecycle?.length ?? 'MISSING');
            console.log('categoryByCalendar rows:', data.categoryByCalendar?.length ?? 'MISSING');
            if (data.categoryByLifecycle?.length > 0) {
              console.log('\nLifecycle sample:', data.categoryByLifecycle.slice(0, 3));
            }
            if (data.categoryByCalendar?.length > 0) {
              console.log('\nCalendar sample:', data.categoryByCalendar.slice(0, 3));
            }
          } catch(e) {
            console.error('Parse error:', e.message);
            console.error('Raw response:', body2.slice(0, 500));
          }
        });
      });
      apiReq.on('error', e => console.error('API request error:', e.message));
      apiReq.end();
    } catch(e) {
      console.error('Login parse error:', e.message, body.slice(0, 200));
    }
  });
});

loginReq.on('error', (e) => {
  console.error('Login error:', e.message);
  console.log('Server might not be running on port 5002');
});
loginReq.write(loginData);
loginReq.end();
