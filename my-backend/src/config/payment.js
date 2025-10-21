const path = require("path");

module.exports = {
  banks: [
    { bank: "BCA", name: "Printingan.com", account: "1234567890" },
    { bank: "BNI", name: "Printingan.com", account: "9876543210" },
    { bank: "BRI", name: "Printingan.com", account: "001234567890" },
  ],
  qris: {
    imagePath: process.env.QRIS_IMAGE_PATH || null, // contoh: "./qris.png"
    payload: process.env.QRIS_PAYLOAD || null, // payload EMV (opsional)
    merchantLabel: process.env.QRIS_MERCHANT || "Printingan.com",
    resolvePath(p) {
      if (!p) return null;
      return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    },
  },
};
