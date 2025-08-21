// server.js

// 1. ज़रूरी पैकेज इम्पोर्ट करें
const express = require('express');
const fetch = require('node-fetch'); // node-fetch v2 for require
require('dotenv').config();

// 2. सर्वर बनाएँ
const app = express();
const port = process.env.PORT || 3000;

// 3. Middleware सेट करें
app.use(express.static('public'));
app.use(express.json());

// 4. API Keys को सुरक्षित जगह से लोड करें
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
const TTS_API_KEY = process.env.TTS_API_KEY ? process.env.TTS_API_KEY.trim() : null;

// 5. '/translate' endpoint
app.post('/translate', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }
    try {
        const { text, sourceLang, targetLang } = req.body;
        if (!text || !sourceLang || !targetLang) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const isSingleWord = !text.includes(' ');
        const prompt = isSingleWord 
            ? `Translate the word "${text}" from ${sourceLang} to ${targetLang}. Provide only the single translated word.`
            : `Translate the following ${sourceLang} text to ${targetLang}. Provide ONLY the translated text. Text: "${text}"`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error ? data.error.message : `API request failed: ${response.statusText}`;
            console.error('Gemini API Error:', data.error);
            throw new Error(errorMessage);
        }
        
        if (!data.candidates || data.candidates.length === 0) {
            console.error('Invalid Gemini Response:', data);
            throw new Error('No translation candidate found in the API response.');
        }

        const translatedText = data.candidates[0].content.parts[0].text;
        res.json({ translation: translatedText.trim() });

    } catch (error) {
        console.error('Translation Error:', error.message);
        res.status(500).json({ error: 'Failed to translate text', details: error.message });
    }
});

// 6. '/suggest-reply' endpoint
app.post('/suggest-reply', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }
    try {
        const { text, language } = req.body;
        if (!text || !language) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const prompt = `I received a message in ${language} that says: "${text}". Suggest three short, common, and natural-sounding replies in ${language}. Provide ONLY the three replies, each on a new line. Do not add numbers, bullets, or any extra text.`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (!response.ok) throw new Error(`API request failed`);
        const data = await response.json();
        const suggestionsText = data.candidates[0].content.parts[0].text;
        const suggestions = suggestionsText.trim().split('\n').filter(line => line.trim() !== '');
        res.json({ suggestions });
    } catch (error) {
        console.error('Suggestion Error:', error);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// 7. '/synthesize-speech' endpoint
app.post('/synthesize-speech', async (req, res) => {
    if (!TTS_API_KEY) {
        return res.status(500).json({ error: 'TTS API key is not configured on the server.' });
    }
    try {
        const { text, langCode } = req.body;
        if (!text || !langCode) {
            return res.status(400).json({ error: 'Missing text or language code' });
        }
        const ttsApiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;
        const requestBody = {
            input: { text: text },
            voice: { languageCode: langCode, ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' }
        };
        const response = await fetch(ttsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error ? data.error.message : `TTS API request failed: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        res.json(data);
    } catch (error) {
        console.error('Speech Synthesis Error:', error.message);
        res.status(500).json({ error: 'Failed to synthesize speech', details: error.message });
    }
});

// 8. सर्वर को शुरू करें
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
