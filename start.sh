
#!/bin/bash

RECORDING_DIR="/opt/clipforge/captures"
XVFB_DISPLAY=":99"
PREFERENCES_FILE="/opt/clipforge/discord_user_data/Default/Preferences"

function check_crash_status {
    echo "Checking for crash status in Preferences file..."
    if grep -q '"exit_type":"Crashed"' "$PREFERENCES_FILE"; then
        echo "Crash detected. Updating Preferences file..."
        sed -i 's/"exit_type":"Crashed"/"exit_type":"none"/' "$PREFERENCES_FILE"
        echo "Crash status updated to 'none'."
    else
        echo "No crash detected."
    fi
}

function start_xvfb {
    echo "Starting Xvfb on display ${XVFB_DISPLAY}..."
    pkill -x Xvfb || true
    Xvfb $XVFB_DISPLAY -screen 0 1920x1080x24 > /dev/null 2>&1 &
    export DISPLAY=$XVFB_DISPLAY
    sleep 2
    echo "Xvfb started."
}

function stop_xvfb {
    echo "Stopping Xvfb..."
    pkill -x Xvfb || true
    echo "Xvfb stopped."
}

function start_pulseaudio {
    echo "Starting PulseAudio..."
    pulseaudio --kill || true
    pulseaudio --start --log-target=syslog
    if ! pactl load-module module-null-sink sink_name=VirtualSink > /dev/null 2>&1; then
        echo "Failed to load VirtualSink. Retrying..."
        sleep 1
        pactl load-module module-null-sink sink_name=VirtualSink > /dev/null 2>&1 || {
            echo "Failed to set up VirtualSink. Exiting..."
            exit 1
        }
    fi
    pactl set-default-sink VirtualSink
    echo "PulseAudio setup complete."
}

function cleanup {
    echo "Cleaning up old files in ${RECORDING_DIR}..."
    find ${RECORDING_DIR} -type f -name "*.mp4" -mtime +1 -delete
    echo "Cleanup complete."
}

function start_bot {
    echo "Starting Discord bot..."
    node main.js &
    BOT_PID=$!
    echo "Discord bot started with PID ${BOT_PID}."
}

function stop_bot {
    echo "Stopping Discord bot..."
    kill ${BOT_PID}
    echo "Discord bot stopped."
}

trap 'stop_bot; stop_xvfb' EXIT

check_crash_status
start_xvfb
start_pulseaudio
cleanup
start_bot
wait
