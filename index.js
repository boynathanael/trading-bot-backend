// =================================================================
// TRADING BOT SIMULATOR - BACKEND (VERSI FINAL)
// =================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Binance = require('node-binance-api');

const app = express();

// --- Konfigurasi Penting ---
const PORT = process.env.PORT || 3001;
// URL Frontend Anda yang sudah di-deploy. Ganti jika berbeda.
const FRONTEND_URL = 'https://trading-bot-frontend-jet.vercel.app'; 

// --- Middleware ---
// Konfigurasi CORS agar hanya frontend Anda yang diizinkan
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// --- Database di Memori (Siap untuk Deploy) ---
let activeConfig = null;
let orderHistory = [];

// --- Inisialisasi Klien Binance ---
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_TESTNET_API_KEY,
    APISECRET: process.env.BINANCE_TESTNET_SECRET_KEY,
    test: true // Menggunakan Binance Testnet
});

// =================================================================
// ENDPOINTS API
// =================================================================

// Endpoint Tes: Untuk memeriksa apakah server hidup
app.get('/', (req, res) => {
    res.status(200).send('Trading Bot Backend is alive and running!');
});

// Menyimpan konfigurasi dari frontend
app.post('/config', (req, res) => {
    activeConfig = req.body;
    console.log('Konfigurasi disimpan:', activeConfig);
    res.status(200).json({ message: 'Konfigurasi berhasil disimpan' });
});

// Mengambil konfigurasi aktif
app.get('/config', (req, res) => {
    if (activeConfig) {
        res.status(200).json(activeConfig);
    } else {
        // Jika belum ada config, kirim respons yang valid agar frontend tidak error
        res.status(200).json(null);
    }
});

// Menerima sinyal dan mengeksekusi order
app.post('/webhook', async (req, res) => {
    const signal = req.body;
    console.log('Sinyal diterima:', signal);

    if (!activeConfig) {
        console.error('Gagal: Konfigurasi strategi belum diatur.');
        return res.status(400).send('Error: Konfigurasi belum diatur.');
    }

    const isBuySignal = signal.plusDI > activeConfig.diPlusThreshold && signal.minusDI < activeConfig.diMinusThreshold && signal.adx > activeConfig.adxMinimum;

    if (!isBuySignal) {
        console.log('Sinyal tidak memenuhi kriteria.');
        return res.status(200).send('Sinyal diterima, namun tidak memenuhi kriteria.');
    }

    console.log(`Sinyal BUY valid terdeteksi untuk ${activeConfig.symbol}! Mencoba eksekusi...`);
    try {
        const quantity = 0.001; // Jumlah order untuk demo
        await binance.futuresLeverage(activeConfig.symbol, activeConfig.leverage);
        const orderResponse = await binance.futuresMarketBuy(activeConfig.symbol, quantity);

        console.log('Order BUY berhasil dieksekusi di Binance:', orderResponse);
        
        const entryPrice = parseFloat(orderResponse.price);
        const executedOrder = {
            symbol: activeConfig.symbol,
            action: "BUY",
            price_entry: entryPrice,
            tp_price: (entryPrice * (1 + activeConfig.takeProfit / 100)).toFixed(2),
            sl_price: (entryPrice * (1 - activeConfig.stopLoss / 100)).toFixed(2),
            leverage: `${activeConfig.leverage}x`,
            timeframe: activeConfig.timeframe,
            timestamp: new Date().toISOString()
        };

        orderHistory.push(executedOrder);
        console.log('Order disimpan ke riwayat:', executedOrder);
        res.status(200).json({ message: 'Order berhasil dieksekusi!' });

    } catch (error) {
        const errorMessage = error.body ? JSON.parse(error.body).msg : error.message;
        console.error('Gagal mengeksekusi order di Binance:', errorMessage);
        res.status(500).send(`Gagal mengeksekusi order: ${errorMessage}`);
    }
});

// Mengambil semua riwayat order
app.get('/orders', (req, res) => {
    res.status(200).json([...orderHistory].reverse());
});

// =================================================================
// LOGIKA STARTUP SERVER
// =================================================================

// Jalankan server HANYA jika file ini dieksekusi secara langsung (untuk development lokal)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server berjalan di http://localhost:${PORT}`);
  });
}

// Ekspor app agar Vercel bisa menggunakannya
module.exports = app;