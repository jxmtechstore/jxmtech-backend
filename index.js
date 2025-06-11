
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
