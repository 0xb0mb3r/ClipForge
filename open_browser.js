const puppeteer = require('puppeteer');

const DISCORD_URL = 'https://discord.com/';
const USER_DATA_DIR = '/opt/clipforge/user_data';

async function openBrowser() {
    console.log('Opening browser to set up Discord login...');

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: USER_DATA_DIR,
        args: [
            '--start-maximized', // Start in maximized mode
            '--disable-dev-shm-usage',
            '--no-sandbox'
        ]
    });

    const [page] = await browser.pages(); // Use the first tab opened
    await page.setViewport({
        width: 1920, // Set to fullscreen dimensions
        height: 1080
    });

    await page.goto(DISCORD_URL, { waitUntil: 'networkidle2' });

    console.log('Log in to Discord, and then close the browser.');

    // Wait for 60 seconds to allow manual login
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed.');
}

openBrowser().catch((error) => {
    console.error('An error occurred:', error);
});
