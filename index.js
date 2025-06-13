// =================================================================
// TRADING BOT SIMULATOR - BACKEND (VERSI UNTUK RENDER.COM)
// =================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Binance = require('node-binance-api');

const app = express();

// --- Konfigurasi Penting ---
// Render akan menyediakan process.env.PORT secara otomatis
const PORT = process.env.PORT || 3001; 
// URL Frontend Anda yang sudah di-deploy
const FRONTEND_URL = 'https://trading-bot-frontend-jet.vercel.app'; 

// --- Middleware ---
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// --- Database di Memori ---
let activeConfig = null;
let orderHistory = [];

// =================================================================
// ENDPOINTS API (Tidak ada perubahan di sini)
// =================================================================

// Endpoint Tes
app.get('/', (req, res) => {
    res.status(200).send('Trading Bot Backend is alive and running!');
});

// Menyimpan konfigurasi
app.post('/config', (req, res) => {
    activeConfig = req.body;
    console.log('Konfigurasi disimpan:', activeConfig);
    res.status(200).json({ message: 'Konfigurasi berhasil disimpan' });
});

// Mengambil konfigurasi
app.get('/config', (req, res) => {
    res.status(200).json(activeConfig);
});

// Menerima sinyal webhook
app.post('/webhook', async (req, res) => {
    const signal = req.body;
    console.log('Sinyal diterima:', signal);

    if (!activeConfig) {
        return res.status(400).send('Error: Konfigurasi belum diatur.');
    }

    const isBuySignal = signal.plusDI > activeConfig.diPlusThreshold && signal.minusDI < activeConfig.diMinusThreshold && signal.adx > activeConfig.adxMinimum;

    if (!isBuySignal) {
        return res.status(200).send('Sinyal tidak memenuhi kriteria.');
    }

    console.log(`Sinyal BUY valid terdeteksi...`);
    try {
        const binance = new Binance().options({
            APIKEY: process.env.BINANCE_TESTNET_API_KEY,
            APISECRET: process.env.BINANCE_TESTNET_SECRET_KEY,
            test: true
        });

        const quantity = 0.001;
        await binance.futuresLeverage(activeConfig.symbol, activeConfig.leverage);
        const orderResponse = await binance.futuresMarketBuy(activeConfig.symbol, quantity);

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
        res.status(200).json({ message: 'Order berhasil dieksekusi!' });

    } catch (error) {
        const errorMessage = error.body ? JSON.parse(error.body).msg : "Gagal terhubung ke Binance.";
        console.error('Gagal mengeksekusi order:', errorMessage);
        res.status(500).send(`Gagal mengeksekusi order: ${errorMessage}`);
    }
});

// Mengambil riwayat order
app.get('/orders', (req, res) => {
    res.status(200).json([...orderHistory].reverse());
});

// =================================================================
// LOGIKA STARTUP SERVER (VERSI UNTUK RENDER)
// =================================================================

// Render lebih suka app.listen() yang sederhana.
app.listen(PORT, () => {
  console.log(`Backend server berjalan di port ${PORT}`);
});