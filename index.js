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

    // Validate IPN with PayPal
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

    const orderId = txn_id || `PAID-${Date.now()}`;
    const orderData = {
      data: [{
        email,
        shipping_address: address,
        product_name: item_name,
        product_price: mc_gross,
        order_date: new Date().toISOString(),
        status: "Paid",
        order_id: orderId
      }]
    };

    // Save order to SheetDB
    await fetch("https://sheetdb.io/api/v1/rxstv2pbzdkc3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    console.log("✅ Order recorded:", orderData);

    // Send confirmation email using EmailJS
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        service_id: "service_lkx8hde",
        template_id: "template_j6e2hbv",
        user_id: "X5EyJsvtspdoQsts0",
        template_params: {
          email,
          product_name: item_name,
          order_id: orderId
        }
      })
    });

    console.log("📧 Confirmation email sent to:", email);
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
