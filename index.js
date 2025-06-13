// =================================================================
// TRADING BOT SIMULATOR - BACKEND (VERSI FINAL REVISI 2 - HAIL MARY)
// =================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Binance = require('node-binance-api');

// --- Inisialisasi Aplikasi Express ---
const app = express();

// --- Konfigurasi ---
const FRONTEND_URL = 'https://trading-bot-frontend-jet.vercel.app';

// --- Middleware ---
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// --- Database di Memori ---
let activeConfig = null;
let orderHistory = [];

// =================================================================
// ENDPOINTS API (SAMA SEPERTI SEBELUMNYA)
// =================================================================
app.get('/', (req, res) => res.status(200).send('Backend is alive!'));
app.post('/config', (req, res) => {
    activeConfig = req.body;
    res.status(200).json({ message: 'Konfigurasi berhasil disimpan' });
});
app.get('/config', (req, res) => res.status(200).json(activeConfig));
app.get('/orders', (req, res) => res.status(200).json([...orderHistory].reverse()));

app.post('/webhook', async (req, res) => {
    // ... (SELURUH LOGIKA /webhook ANDA TETAP SAMA DI SINI) ...
    // Salin-tempel seluruh blok app.post('/webhook', ...) Anda yang lama ke sini
    const signal = req.body;
    if (!activeConfig) return res.status(400).send('Error: Konfigurasi belum diatur.');
    const isBuySignal = signal.plusDI > activeConfig.diPlusThreshold && signal.minusDI < activeConfig.diMinusThreshold && signal.adx > activeConfig.adxMinimum;
    if (!isBuySignal) return res.status(200).send('Sinyal diterima, tidak memenuhi kriteria.');
    
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
        res.status(500).send(`Gagal mengeksekusi order: ${errorMessage}`);
    }
});

// =================================================================
// EKSPOR UNTUK VERCEL
// =================================================================
// Ini akan mengeksekusi seluruh aplikasi sebagai satu fungsi.
// Ini adalah cara paling 'native' untuk Vercel.
module.exports = app;