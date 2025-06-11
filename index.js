const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// PayPal IPN Verification + Order Handling
app.post('/api/verify-paypal', async (req, res) => {
  try {
    const rawBody = Object.entries(req.body)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    // Validate IPN with PayPal
    const paypalRes = await fetch('https://ipnpb.sandbox.paypal.com/cgi-bin/webscr', {
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
    } = req.body;

    if (payment_status !== 'Completed') {
      console.log('Payment not completed');
      return res.sendStatus(200);
    }

    const { email, address } = JSON.parse(custom);

    const orderData = {
      data: [{
        email,
        shipping_address: address,
        product_name: item_name,
        product_price: mc_gross,
        order_date: new Date().toISOString(),
        status: "Paid",
        order_id: `PAID-${Date.now()}`
      }]
    };

    // Save to SheetDB
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

const express = require("express");
const bodyParser = require("body-parser");
const verifyPayPalIPN = require("./verify-paypal");
const postToSheet = require("./sheetdb");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/api/verify-paypal", async (req, res) => {
  try {
    await verifyPayPalIPN(req.body);

    const data = {
      email: req.body.custom ? JSON.parse(req.body.custom).email : "unknown",
      shipping_address: req.body.custom ? JSON.parse(req.body.custom).address : "unknown",
      product_name: req.body.item_name,
      product_price: req.body.mc_gross,
      order_id: req.body.txn_id,
      order_date: new Date().toISOString(),
      status: "Pending"
    };

    await postToSheet(data);
    res.sendStatus(200);
  } catch (err) {
    console.error("PayPal IPN failed:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
