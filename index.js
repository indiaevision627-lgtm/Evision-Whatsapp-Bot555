const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Gemini Import
const path = require('path');
require('dotenv').config();

console.log("Starting WhatsApp AI Bot with Gemini...");

// Securely load API Key from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Use a lite and fast model to save quota
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

// Simple cache for common greetings to save API quota
const commonGreetings = {
    'hi': 'Hello! E-Vision India WhatsApp Assistant me aapka swagat hai. Main aapki kaise madad kar sakta hoon? 😊',
    'hello': 'Hello! Welcome to E-Vision India. Aapko CCTV cameras ya installation ke baare me kuch puchna hai?',
    'hey': 'Hey there! How can I help you with our Smart Cameras today?',
    'hy': 'Hello! E-Vision India me aapka swagat hai. Aapko ghar ke liye camera chahiye ya office ke liye?',
    'hlo': 'Hello! Kaise hain aap? Main aapki CCTV requirements me kaise madad kar sakta hoon?',
    'namaste': 'Namaste! E-Vision India me aapka swagat hai. Main aapki kaise madad kar sakta hoon?'
};

// Ye instructions Gemini AI ko batayengi ki usko kya bankar baat karni hai
const botInstructions = `
You are the official WhatsApp AI assistant for 'E-Vision India' and its store 'ShopEvision' (https://shopevision.com/).
Location: 9/205, Old Faridabad-121002. Contact: +91-9811250806, +91-9319183121.

Language Rule: Always reply in the SAME language the user speaks (Hindi or English).

PRODUCT MATCHING LOGIC & VERIFIED LINKS:
1. **Home / Small Shop (Indoor)**:
   - "Basic Guard" (WiFi, Single Lens) - https://shopevision.com/product/ev-q208-single-lens-wifi-camera/
   - "Smart Guard" (WiFi/4G, Dual Lens) - https://shopevision.com/product/dual-lens-wifi-4g-model/
2. **Farm / Warehouse / Remote Area (No WiFi)**:
   - "4G Watch Pro" (4G SIM based) - https://shopevision.com/product/dual-lens-wifi-4g-model-ev-a408-wifi-ev-a408-4g/
   - "4G Watch Max" (Dual Lens 4G) - https://shopevision.com/product/dual-lens-wifi-4g-model-ev-a412-wifi-ev-a412-4g/
   - "Solar Sentinel" (Solar Powered) - https://shopevision.com/product/ev-g6w-black-light-full-colour/
   - "Solar Sentinel AI" (Always-On 7/24h) - https://shopevision.com/product/ev-always-on-video-solar-camera-724h/
3. **Large Projects / Buildings / Schools**:
   - "IP Camera Sets" (4 or 8 cameras) - https://shopevision.com/product/4-set-ip-4mp-dome-setup/
   - "PoE Switches" (Managed/Unmanaged) - https://shopevision.com/product/42-port-manageable-poe-switch/

PROFESSIONAL POLICIES:
- **Shipping**: Pan-India delivery (3-10 days). https://shopevision.com/shipping-policy/
- **Returns**: 7 Days window (Unused & Original packaging). https://shopevision.com/return-refund-policy/
- **Installation**: Shipping does not include installation (Paid service).

SALES PROMPT:
- If someone asks for a camera recommendation, ask: "Aapko ghar ke liye chahiye ya office ke liye?" and "WiFi available hai ya nahi?".
- Always provide the correct product link for the recommendation.
- Tell them: "Aap hamari website se direct order kar sakte hain."
`;

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Dummy server so Render doesn't crash with "Timed Out"
app.get('/', (req, res) => res.send('<h1>WhatsApp Bot is Live!</h1><p>Visit <a href="/qr">/qr</a> to see the QR code.</p>'));

// Serve the QR code image via web
app.get('/qr', (req, res) => {
    const qrPath = path.join(__dirname, 'whatsapp_qr.png');
    res.sendFile(qrPath, (err) => {
        if (err) {
            res.status(404).send('QR Code not found or not generated yet. Please check logs.');
        }
    });
});

app.listen(port, () => console.log(`🌍 Server running on port ${port}`));

console.log("Initializing WhatsApp Client...");
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-acceleration',
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Memory saving
            '--disable-blink-features=AutomationControlled'
        ]
    }
});

console.log("Starting WhatsApp Client initialize()...");

// Jab QR code generate ho, toh usko terminal mein dikhao
client.on('qr', async (qr) => {
    console.log('\n======================================================');
    console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP NUMBER');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });

    // Capture screenshot of the QR code for the user
    try {
        const page = client.pupPage;
        if (page) {
            await page.screenshot({ path: 'whatsapp_qr.png' });
            console.log('✅ QR Code screenshot saved to: whatsapp_qr.png');
        }
    } catch (err) {
        console.error('Failed to capture QR screenshot:', err);
    }
});

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
});

// Jab bot successfully connect ho jaye
client.on('ready', () => {
    console.log('\n✅ SUCCESS: Evision Gemini Bot is Ready!');
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        console.log('⚠️ WARNING: Gemini API Key missing! Bot will not reply properly until you paste it in index.js');
    }
    console.log('Waiting for incoming messages...\n');
});

// har user ka chat history save karne ke liye
const userSessions = new Map();

// track users who have been notified of after-hours
const notifiedAway = new Set();

// track users currently being processed to prevent overlapping requests
const userProcessingLock = new Set();

// Helper for exponential backoff retry logic
async function sendMessageWithRetry(chat, text, maxRetries = 5) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await chat.sendMessage(text);
            return result.response.text();
        } catch (error) {
            lastError = error;
            // 429 is Rate Limit or Quota error
            if (error.status === 429) {
                const waitTime = 10000 * (i + 1); // Start with 10s wait
                console.log(`⚠️ Quota hit. Retrying in ${waitTime/1000}s... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// Jab koi naya message aaye
client.on('message', async (message) => {
    const text = message.body;
    const sender = message.from;

    console.log(`📩 New Message received from ${sender}: ${text}`);

    // Ignore status updates and group messages to save API quota
    if (sender === "status@broadcast" || sender.includes("@g.us")) {
        console.log("-> Ignoring status/group message.");
        return;
    }

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        await message.reply("Opps! Bot me abhi AI Key nahi dali hui. Developer please index.js mein Gemini API key update karein.");
        return;
    }

    // 1. Filter empty or junk messages
    if (!text || text.trim().length === 0) {
        console.log("-> Ignoring empty/junk message.");
        return;
    }

    // 3. Quick Reply for common greetings (Saves API Quota)
    const lowerText = text.toLowerCase().trim();
    if (commonGreetings[lowerText]) {
        console.log(`-> Using cached response for: ${lowerText}`);
        await message.reply(commonGreetings[lowerText]);
        userProcessingLock.delete(sender);
        return;
    }

    try {
        console.log("-> Thinking (Asking Gemini AI)...");
        
        // Gemini model ko call karna
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL, 
            systemInstruction: botInstructions 
        });

        // Nayi chat shuru karo agar user purana na ho
        let chat = userSessions.get(sender);
        if (!chat) {
            chat = model.startChat({ history: [] });
            userSessions.set(sender, chat);
        }
        
        // Use retry logic to handle rate limits (429)
        const responseText = await sendMessageWithRetry(chat, text);

        await message.reply(responseText);
        console.log("-> Sent Gemini AI response with memory!");

    } catch (error) {
        console.error("❌ Gemini Error:", error);
        // Provide user-friendly error message if still hitting limits after retries
        if (error.status === 429) {
            await message.reply("Maaf kijiyega, abhi messages ki limit khatam ho gayi hai. Hum thodi der me phir se online honge! 🙏");
        } else {
            await message.reply("Sorry, hamara AI server abhi thoda busy hai. Thodi der baad try karein.");
        }
    } finally {
        // Unlock user for next message
        userProcessingLock.delete(sender);
    }
});

client.on('auth_failure', () => {
    console.error('❌ Authentication failed! Please restart and scan QR code again.');
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Disconnected:', reason);
});

// Client ko start karo
client.initialize();
