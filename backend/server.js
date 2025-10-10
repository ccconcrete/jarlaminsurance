// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(express.json());

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: FRONTEND_ORIGIN }));

const NMI_ENDPOINT = process.env.NMI_ENDPOINT || 'https://secure.networkmerchants.com/api/transact.php';
const NMI_SECURITY_KEY = process.env.NMI_SECURITY_KEY;

if (!NMI_SECURITY_KEY) {
  console.error('NMI_SECURITY_KEY is not set. Set it in env!');
  process.exit(1);
}

function logLine(line) {
  const t = new Date().toISOString() + ' ' + line + '\n';
  fs.appendFile('payments.log', t, ()=>{});
}

app.post('/process-payment', async (req, res) => {
  try {
    const body = req.body || {};
    const token = body.payment_token || body.token;
    const amount = (body.amount || '').toString();

    if (!token || !amount) {
      return res.status(400).json({ success: false, message: 'missing token or amount' });
    }

    const params = new URLSearchParams();
    params.append('security_key', NMI_SECURITY_KEY);
    params.append('type', 'sale');
    params.append('payment_token', token);
    params.append('amount', Number(amount).toFixed(2));
    if (body.invoice) params.append('orderid', body.invoice);
    if (body.fname) params.append('first_name', body.fname);
    if (body.lname) params.append('last_name', body.lname);
    if (body.email) params.append('email', body.email);
    if (body.address1) params.append('address1', body.address1);
    if (body.city) params.append('city', body.city);
    if (body.state) params.append('state', body.state);
    if (body.zip) params.append('zip', body.zip);
    if (body.country) params.append('country', body.country);

    logLine('REQUEST -> ' + JSON.stringify({ orderid: params.get('orderid'), amount: params.get('amount') }));

    const nmiResp = await axios.post(NMI_ENDPOINT, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });

    const parsed = Object.fromEntries(new URLSearchParams(nmiResp.data));
    logLine('NMI RESP -> ' + JSON.stringify(parsed));

    const ok = parsed.response === '1' || parsed.response_code === '100' || /APPROV/i.test(parsed.responsetext || '');

    if (ok) {
      return res.json({ success: true, data: parsed });
    } else {
      return res.status(402).json({ success: false, data: parsed });
    }
  } catch (err) {
    console.error('process-payment error', err && (err.response?.data || err.message || err));
    logLine('ERROR -> ' + (err && (err.response?.data || err.message || JSON.stringify(err))));
    return res.status(500).json({ success: false, message: 'server_error', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server listening on', PORT));
