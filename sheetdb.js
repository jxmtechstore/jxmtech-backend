
const axios = require("axios");

module.exports = async function postToSheet(data) {
  const response = await axios.post("https://sheetdb.io/api/v1/rxstv2pbzdkc3", {
    data: data
  });
  return response.data;
};
