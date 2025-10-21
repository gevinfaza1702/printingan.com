const fs = require("fs");
const QRCode = require("qrcode");

async function makeQrisDataUrl({ imagePath, payload }) {
  // 1) jika ada file gambar QR → pakai itu
  if (imagePath) {
    try {
      const buf = fs.readFileSync(imagePath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch (e) {
      console.warn("[QRIS] gagal baca file:", e.message);
    }
  }
  // 2) kalau ada payload EMV → generate QR
  if (payload) {
    try {
      return await QRCode.toDataURL(payload, { width: 360, margin: 1 });
    } catch (e) {
      console.warn("[QRIS] gagal generate:", e.message);
    }
  }
  return null;
}

module.exports = { makeQrisDataUrl };
