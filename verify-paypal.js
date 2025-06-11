
const axios = require("axios");
const qs = require("qs");

module.exports = async function verifyPayPalIPN(body) {
  const payload = 'cmd=_notify-validate&' + qs.stringify(body);

  const response = await axios.post(
    "https://ipnpb.paypal.com/cgi-bin/webscr",
    payload,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  if (response.data !== "VERIFIED") {
    throw new Error("IPN not verified");
  }

  return true;
};
