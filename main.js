const puppeteer = require('puppeteer');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_URL = 'DISCORD_VOICE_CHANNEL_URL';
const USER_DATA_DIR = '/opt/clipforge/user_data';
const RECORDING_DIR = '/opt/clipforge/captures';
const HOSTED_DIR = '/opt/clipforge/hosted';
const DISPLAY = ':99';
const WEB_SERVER_PORT = 8080;
const PIPE_PATH = '/tmp/clipforge-pipe';
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const COMMAND_CHANNEL_ID = 'COMMAND_CHANNEL_ID';
const CLIP_DOMAIN = 'example.com';

if (!fs.existsSync(RECORDING_DIR)) fs.mkdirSync(RECORDING_DIR);
if (!fs.existsSync(HOSTED_DIR)) fs.mkdirSync(HOSTED_DIR);

let continuousRecordingFile;
let recordingProcess;
let isProcessingClip = false; // Prevent duplicate clip processing
let browserInstance = null;

async function launchBrowser() {
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: USER_DATA_DIR,
        args: [
            '--start-maximized',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-infobars',
            '--disable-extensions',
        ],
        defaultViewport: null,
    });

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    console.log('Navigating to Discord channel...');
    await page.goto(DISCORD_URL, { waitUntil: 'networkidle2' });

    console.log('Maximizing and centering browser window...');
    try {
        const session = await page.target().createCDPSession();
        const { windowId } = await session.send('Browser.getWindowForTarget');
        await session.send('Browser.setWindowBounds', {
            windowId,
            bounds: { width: 1920, height: 1080, left: 0, top: 0 },
        });
        console.log('Browser window maximized and centered.');
    } catch (error) {
        console.error('Could not maximize browser window:', error.message);
        await page.setViewport({ width: 1920, height: 1080 });
    }

    return { browser, page };
}

function startRecording(outputFile) {
    console.log(`Starting continuous recording with rolling buffer to ${outputFile}...`);
    const rollingBufferFile = path.join(RECORDING_DIR, 'rolling_buffer.mkv'); // Back to MKV
    const ffmpegCmd = `
        ffmpeg -y -f x11grab -i ${DISPLAY} \
        -f pulse -i VirtualSink.monitor \
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
        -c:a aac -b:a 128k \
        -t 3600 -f matroska \
        ${rollingBufferFile} \
        -hide_banner -loglevel error
    `;
    recordingProcess = exec(ffmpegCmd.trim());
    recordingProcess.stderr.on('data', data => console.log(`FFmpeg Error: ${data}`));
    recordingProcess.on('close', code => console.log(`FFmpeg exited with code: ${code}`));

    // Set the rolling buffer file as the source for clips
    continuousRecordingFile = rollingBufferFile;
}


function saveClip(clipName = `clip-${Date.now()}.mp4`, message = null) {
    const length = 60; // Fixed clip length
    console.log(`Saving the last ${length} seconds...`);
    const tempFile = path.join(RECORDING_DIR, `temp_recording-${Date.now()}.mkv`);
    const outputClip = path.join(HOSTED_DIR, clipName);

    if (!continuousRecordingFile) {
        console.error('Continuous recording file not defined. Cannot save clip.');
        if (message) {
            message.reply('Continuous recording file not defined. Clip cannot be saved.');
        }
        return;
    }

    try {
        // Pause FFmpeg rolling buffer process
        console.log('Pausing FFmpeg rolling buffer process...');
        if (recordingProcess) {
            recordingProcess.kill('SIGSTOP'); // Temporarily pause the recording
        }

        // Copy the rolling buffer to a temporary file
        console.log('Copying rolling buffer to a temporary file...');
        execSync(`cp ${continuousRecordingFile} ${tempFile}`);
        execSync('sync'); // Ensure all writes are flushed to disk

        console.log('Remuxing temporary file to ensure proper indexing...');
        const remuxedTempFile = tempFile.replace('.mkv', '-remuxed.mp4');
        const remuxCmd = `
            ffmpeg -y -i ${tempFile} -c copy ${remuxedTempFile} -hide_banner -loglevel error
        `;
        execSync(remuxCmd.trim());
        console.log(`Temporary file remuxed: ${remuxedTempFile}`);

        // Validate remuxed file duration
        const ffprobeCmd = `ffprobe -i ${remuxedTempFile} -show_entries format=duration -v quiet -of csv="p=0"`;
        const tempFileDuration = parseFloat(execSync(ffprobeCmd).toString().trim());
        console.log(`Temporary file duration: ${tempFileDuration}s`);

        if (isNaN(tempFileDuration) || tempFileDuration < length) {
            throw new Error(`Deggr Chill de Bot isch erscht sit ${tempFileDuration}s dinne`); 
        }

        // Calculate the start time for the clip
        const startTime = Math.max(tempFileDuration - length, 0);
        console.log(`Calculated start time for clip: ${startTime}s`);

        // Use ffmpeg to create the clip
        const ffmpegClipCmd = `
            ffmpeg -y -ss ${startTime} -i ${remuxedTempFile} \
            -t ${length} -c copy ${outputClip} \
            -hide_banner -loglevel error
        `;
        console.log(`Running ffmpeg command to save clip: ${ffmpegClipCmd.trim()}`);
        execSync(ffmpegClipCmd.trim());

        // Validate final clip duration
        const finalClipDuration = parseFloat(execSync(`ffprobe -i ${outputClip} -show_entries format=duration -v quiet -of csv="p=0"`).toString().trim());
        console.log(`Final clip duration: ${finalClipDuration}s`);

        if (Math.abs(finalClipDuration - length) > 1) { // Allow a small tolerance
            throw new Error(`Clip duration mismatch. Expected: ${length}s, Actual: ${finalClipDuration}s`);
        }

        console.log(`Clip saved to ${outputClip}`);
        if (message) {
            message.reply(`Clip created! Download it here: https://${CLIP_DOMAIN}/${clipName}`);
        }
    } catch (err) {
        console.error(`Error saving clip: ${err.message}`);
        if (message) {
            message.reply(`Failed to save the clip: ${err.message}`);
        }
    } finally {
        // Cleanup and resume recording process
        console.log('Cleaning up temporary files and resuming recording process...');
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        const remuxedTempFile = tempFile.replace('.mkv', '-remuxed.mp4');
        if (fs.existsSync(remuxedTempFile)) fs.unlinkSync(remuxedTempFile);
        if (recordingProcess) recordingProcess.kill('SIGCONT'); // Resume recording process
    }
}




function createNamedPipe() {
    if (fs.existsSync(PIPE_PATH)) fs.unlinkSync(PIPE_PATH);
    console.log('Creating named pipe...');
    execSync(`mkfifo ${PIPE_PATH}`);
    console.log('Named pipe created.');
}

function startPipeListener() {
    const pipe = fs.createReadStream(PIPE_PATH, { encoding: 'utf8' });
    console.log(`Listening for commands on ${PIPE_PATH}...`);

    pipe.on('data', async (data) => {
        if (isProcessingClip) {
            console.log('Clip command is already being processed. Ignoring...');
            return;
        }

        isProcessingClip = true; // Prevent duplicate processing
        const [command, arg, clipName] = data.trim().split(' ');
        console.log(`Received command from pipe: ${command}`);
        if (command === 'clip') {
            const length = parseInt(arg) || 30;
            saveClip(length, clipName);
        } else if (command === 'stop') {
            console.log('Stopping recording...');
            if (recordingProcess) recordingProcess.kill('SIGINT');
            console.log('Recording stopped.');
        }
        isProcessingClip = false; // Reset flag
    });

    pipe.on('end', () => {
        console.log('Pipe ended. Listener not restarted to avoid duplicates.');
    });
}

function initializeDiscordBot() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    client.once('ready', () => {
        console.log(`Discord bot logged in as ${client.user.tag}`);
    });

    client.on('messageCreate', async (message) => {
        if (message.channel.id !== COMMAND_CHANNEL_ID || message.author.bot) return;

        const command = message.content.trim().toLowerCase();

        console.log(`Received command from Discord: ${command}`);

        try {
            if (command === '/clip') {
                if (isProcessingClip) {
                    console.log('Clip command already in progress. Ignoring...');
                    message.reply('A clip is already being processed. Please wait.');
                    return;
                }

                isProcessingClip = true; // Prevent duplicate commands
                const clipName = `clip-${Date.now()}.mp4`;
                console.log(`Processing /clip command.`);

                if (fs.existsSync(PIPE_PATH)) {
                    saveClip(clipName, message);
                } else {
                    message.reply('Failed to communicate with the recording process. Is it running?');
                }
                isProcessingClip = false; // Reset flag
            } else if (command === '/stop') {
                console.log('Processing /stop command.');
                if (fs.existsSync(PIPE_PATH)) {
                    fs.appendFileSync(PIPE_PATH, 'stop\n');
                    message.reply('Requested to stop the recording.');
                } else {
                    message.reply('Failed to communicate with the recording process. Is it running?');
                }
            } else if (command === '/join') {
                console.log('Processing /join command.');
                browserInstance = await launchBrowser();

                if (!browserInstance) {
                    message.reply('Failed to join the voice channel due to a browser error.');
                    return;
                }

                const { browser, page } = browserInstance;
                try {
                    console.log('Looking for the "Join Voice" button...');
                    const buttons = await page.$$('button');
                    for (const button of buttons) {
                        const text = await button.evaluate(el => el.textContent.trim());
                        if (text === 'Join Voice') {
                            await button.click();
                            console.log('Successfully joined the voice channel.');
                            message.reply('Joined the voice channel.');

                            continuousRecordingFile = path.join(RECORDING_DIR, `continuous_recording-${Date.now()}.mp4`);
                            startRecording(continuousRecordingFile);
                            return;
                        }
                    }
                    throw new Error('Join Voice button not found.');
                } catch (error) {
                    console.error('Error during /join command:', error.message);
                    message.reply('An error occurred while joining the voice channel.');
                }
            } else if (command === '/leave') {
                console.log('Processing /leave command.');
            
                if (recordingProcess) {
                    console.log('Stopping recording...');
                    recordingProcess.kill('SIGINT');
                    console.log('Recording stopped.');
                }
            
                // Clean up the captures folder
                const capturesFolder = '/opt/clipforge/captures';
                console.log(`Purging ${capturesFolder}...`);
                const fs = require('fs');
                fs.readdir(capturesFolder, (err, files) => {
                    if (err) {
                        console.error(`Failed to read ${capturesFolder}:`, err);
                        return;
                    }
                    for (const file of files) {
                        fs.unlink(`${capturesFolder}/${file}`, (err) => {
                            if (err) {
                                console.error(`Failed to delete ${file}:`, err);
                            } else {
                                console.log(`Deleted ${file}`);
                            }
                        });
                    }
                });
            
                try {
                    if (browserInstance && browserInstance.browser) {
                        console.log('Closing browser instance...');
                        await browserInstance.browser.close();
                        console.log('Browser closed successfully.');
                        message.reply('Left the voice channel and purged old recordings.');
                    } else {
                        console.log('No active browser instance found.');
                        message.reply('The bot is not in a voice channel.');
                    }
                } catch (error) {
                    console.error('Error during /leave command:', error.message);
                    message.reply('An error occurred while leaving the voice channel.');
                }
            
                browserInstance = null; // Reset browser instance
            }
             else {
                message.reply('Invalid command. Use `/join`, `/clip` or `/leave`.');
            }
        } catch (error) {
            console.error(`Error processing command ${command}:`, error);
            message.reply('An error occurred while processing your command.');
        }
    });

    client.login(BOT_TOKEN);
}




(async () => {
    createNamedPipe();
    startPipeListener();
    initializeDiscordBot();
})();