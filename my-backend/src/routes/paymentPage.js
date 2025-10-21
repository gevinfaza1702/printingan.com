const express = require("express");
const db = require("../db");
const { banks, qris } = require("../config/payment");
const { makeQrisDataUrl } = require("../services/qris");

const router = express.Router();

router.get("/:orderId", async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!orderId) return res.status(400).send("Invalid order id");

  db.get(
    `SELECT id, title, amount_total, status, payment_required, paid_at, payment_deadline
       FROM client_orders WHERE id=?`,
    [orderId],
    async (err, o) => {
      if (err) return res.status(500).send("DB error");
      if (!o) return res.status(404).send("Order not found");

      // Normalisasi flag & status
      const status = String(o.status || "").toLowerCase();
      const isCanceled = status === "cancel";
      const isPaid = !!o.paid_at;
      const isDone = status === "done";
      const requiresPay = Number(o.payment_required) === 1;

      // Deadline hanya relevan untuk prepaid
      const deadline = o.payment_deadline
        ? new Date(
            (o.payment_deadline.includes("T")
              ? o.payment_deadline.replace("Z", "")
              : o.payment_deadline + "Z"
            ).replace(" ", "T")
          )
        : null;

      const now = new Date();
      const expired =
        requiresPay && deadline ? now.getTime() > deadline.getTime() : false;

      // Boleh bayar?
      let canPayNow = false;
      if (!isCanceled && !isPaid) {
        canPayNow = requiresPay ? !expired : isDone; // prepaid: sebelum expire, postpaid: saat sudah done
      }

      // Alasan disable (untuk banner merah)
      let disabledReason = null;
      if (!canPayNow) {
        if (isCanceled) disabledReason = "Pesanan ini sudah dibatalkan.";
        else if (isPaid) disabledReason = "Pesanan ini sudah dibayar.";
        else if (requiresPay && expired)
          disabledReason = "Waktu pembayaran sudah habis.";
        else if (!requiresPay && !isDone)
          disabledReason =
            "Pesanan ini tidak perlu dibayar di awal (postpaid).";
      }

      const qrisImgDataUrl = await makeQrisDataUrl({
        imagePath: qris.resolvePath(qris.imagePath),
        payload: qris.payload,
      });

      const fmtIDR = (n) =>
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(Math.round(Number(n || 0)));

      res.send(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bayar Pesanan #${o.id}</title>
<style>
body{font-family:ui-sans-serif,system-ui;margin:24px;color:#111827}
.wrap{max-width:900px;margin:0 auto}
.card{border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.06);overflow:hidden}
.head{padding:20px 24px;background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff}
.content{padding:24px;background:#fff}
.row{display:flex;gap:24px;flex-wrap:wrap}
.col{flex:1 1 360px}
.box{border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fafafa}
.label{color:#6b7280;font-size:12px}
.value{font-weight:700}
.btn{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
.btn-primary{background:linear-gradient(90deg,#10b981,#059669);color:#fff}
.btn-ghost{background:#f3f4f6;color:#111827}
.tab{display:flex;gap:8px;margin:12px 0}
.tab button{border:1px solid #e5e7eb;background:#fff;padding:8px 12px;border-radius:999px;cursor:pointer}
.tab button.active{background:#111827;color:#fff;border-color:#111827}
.muted{color:#6b7280;font-size:13px}
.grid2{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center}
.bank{border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-top:8px;background:#fff}
.copy{cursor:pointer;font-size:12px;color:#2563eb;margin-left:8px}
.danger{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:10px;margin-top:12px;display:inline-block}
img.qr{display:block;width:280px;height:280px;object-fit:contain;margin:8px auto;background:#fff;padding:10px;border-radius:12px;border:1px solid #e5e7eb}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="head">
      <div style="font-weight:700;font-size:20px">Bayar Pesanan #${o.id}</div>
      <div style="opacity:.9;font-size:13px;margin-top:4px">${
        o.title || "Pembayaran pesanan"
      }</div>
    </div>
    <div class="content">
      <div class="row">
        <div class="col">
          <div class="box">
            <div class="label">Total yang harus dibayar</div>
            <div class="value" style="font-size:24px">${fmtIDR(
              o.amount_total
            )}</div>
            ${
              requiresPay && deadline
                ? `<div class="muted" style="margin-top:6px">Batas bayar: ${deadline.toLocaleString(
                    "id-ID"
                  )}</div>`
                : ""
            }
          </div>
          ${disabledReason ? `<div class="danger">${disabledReason}</div>` : ""}
          <div class="tab"><button id="tab-bank" class="active">Transfer Bank</button><button id="tab-qris">QRIS</button></div>
          <div id="pane-bank" class="box">
            <div class="muted" style="margin-bottom:8px">Pilih salah satu rekening berikut:</div>
            ${banks
              .map(
                (b) => `
              <div class="bank">
                <div class="grid2">
                  <div class="label">Bank</div><div><b>${b.bank}</b></div>
                  <div class="label">Atas nama</div><div>${b.name}</div>
                  <div class="label">No. Rekening</div>
                  <div><span id="acc-${b.bank}">${b.account}</span><span class="copy" onclick="copy('#acc-${b.bank}')">Salin</span></div>
                </div>
              </div>`
              )
              .join("")}
            <div class="muted" style="margin-top:8px">* Mohon transfer sesuai nominal</div>
          </div>
          <div id="pane-qris" class="box" style="display:none">
            <div class="muted">Scan QRIS berikut menggunakan aplikasi bank/e-wallet Anda.</div>
            ${
              qrisImgDataUrl
                ? `<img class="qr" src="${qrisImgDataUrl}" alt="QRIS"/>`
                : `<div class="danger">QRIS belum dikonfigurasi. Set <b>QRIS_IMAGE_PATH</b> atau <b>QRIS_PAYLOAD</b>.</div>`
            }
            <div style="text-align:center;margin-top:6px;font-weight:600">${
              qris.merchantLabel
            }</div>
          </div>
        </div>
        <div class="col">
          <div class="box">
            <div style="font-weight:600;margin-bottom:8px">Instruksi</div>
            <ol class="muted" style="padding-left:16px">
              <li>Pilih salah satu metode pembayaran (Transfer/QRIS).</li>
              <li>Bayar sesuai nominal yang tertera.</li>
              <li>Setelah pembayaran, klik tombol di bawah untuk konfirmasi (mode development).</li>
            </ol>
            <div style="margin-top:16px">
              <button id="btn-paid" class="btn btn-primary"${
                canPayNow ? "" : " disabled"
              }>Saya sudah bayar</button>
              <button id="btn-refresh" class="btn btn-ghost">Refresh Status</button>
            </div>
            <div id="msg" class="muted" style="margin-top:10px"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
const paneBank=document.getElementById('pane-bank');
const paneQris=document.getElementById('pane-qris');
const tabBank=document.getElementById('tab-bank');
const tabQris=document.getElementById('tab-qris');
tabBank.onclick=()=>{tabBank.classList.add('active');tabQris.classList.remove('active');paneBank.style.display='';paneQris.style.display='none';};
tabQris.onclick=()=>{tabQris.classList.add('active');tabBank.classList.remove('active');paneQris.style.display='';paneBank.style.display='none';};
function copy(sel){const el=document.querySelector(sel);if(!el)return;navigator.clipboard.writeText(el.textContent.trim()).then(()=>alert('Nomor rekening disalin')).catch(()=>{});}
document.getElementById('btn-refresh').onclick=()=>location.reload();
const msg=document.getElementById('msg');const paidBtn=document.getElementById('btn-paid');
if(paidBtn && !paidBtn.disabled){
  paidBtn.onclick=async()=>{
    try{
      const r=await fetch('/api/payments/mock-paid',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({orderId:${o.id}})
      });
      if(r.ok){
        msg.textContent='Terima kasih! Pembayaran terekam (dev). Tutup halaman ini.';
        paidBtn.disabled=true;
      }else{
        const t=await r.text();
        msg.textContent='Gagal mengonfirmasi pembayaran: '+t;
      }
    }catch(e){
      msg.textContent='Jaringan bermasalah.';
    }
  }
}
</script>
</body></html>`);
    }
  );
});

module.exports = router;
