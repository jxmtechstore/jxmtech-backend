const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/api/verify-paypal', async (req, res) => {
  try {
    const rawBody = Object.entries(req.body)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    // Live PayPal endpoint for real transactions:
    const paypalRes = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `cmd=_notify-validate&${rawBody}`,
    });

    const paypalText = await paypalRes.text();

    if (paypalText !== 'VERIFIED') {
      console.error('IPN not verified:', paypalText);
      return res.status(400).send('Invalid IPN');
    }

    const {
      payment_status,
      item_name,
      mc_gross,
      custom,
      txn_id
    } = req.body;

    if (payment_status !== 'Completed') {
      console.log('Payment not completed');
      return res.sendStatus(200);
    }

    const { email, address } = JSON.parse(custom || "{}");

    const orderData = {
      data: [{
        email,
        shipping_address: address,
        product_name: item_name,
        product_price: mc_gross,
        order_date: new Date().toISOString(),
        status: "Paid",
        order_id: txn_id || `PAID-${Date.now()}`
      }]
    };

    await fetch("https://sheetdb.io/api/v1/rxstv2pbzdkc3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    console.log("✅ Order recorded:", orderData);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error verifying PayPal:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
