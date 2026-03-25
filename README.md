# WhatsApp AI Bot - Evision Smart Cameras

This bot is a WhatsApp AI assistant for Evision Smart Cameras, powered by Gemini AI.

## Getting Started

### Local Development
1.  Install dependencies: `npm install`
2.  Set up your `.env` file with `GEMINI_API_KEY`.
3.  Start the bot: `node index.js` or `pm2 start index.js --name whatsapp-bot`

### Cloud Deployment (Render)
This project is configured for easy deployment on Render using Docker.

1.  **Push to GitHub**:
    -   Install [Git](https://git-scm.com/) if you haven't already.
    -   Initialize a repo: `git init`
    -   Add files: `git add .`
    -   Commit: `git commit -m "Initial commit"`
    -   Create a new repo on GitHub and follow the instructions to push.
2.  **Deploy on Render**:
    -   Go to [Render.com](https://render.com/).
    -   Click **New** -> **Blueprint**.
    -   Connect your GitHub repository.
    -   Render will automatically detect the `render.yaml` and configure everything.
    -   **Important**: You must provide the `GEMINI_API_KEY` in the environment variables during setup.

## Configuration
-   **Gemini Model**: Uses `gemini-flash-latest` for stability.
-   **Chrome**: Configured to run in headless mode with necessary Docker arguments.
