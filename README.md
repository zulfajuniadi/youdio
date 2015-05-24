#Youdio

Scrapes YouTube channels, rips the audio, then saves into S3. Backend for the [quliyyah app](http://quliyyah.com).

###Requirements

- nodejs (obviously)
- [youtube-dl](http://rg3.github.io/youtube-dl/)
- ffmpeg
- elastisearch
- Amazon S3 Account
- Google API with youtube access
- git

###Setup

- `git clone` then `npm install`
- rename `.env.sample` to `.env`
- Create a [Google App project](https://console.developers.google.com/project)
    - In APIs & Auth, Under APIs, enable YouTube Data API
    - In APIs & Auth, Under credentials, create a new Server Key under Public API Access. Add the API_KEY in `.env` file to match the generated key
- In your amazon console, go to Security Credentials.
    - Create a new Access Key, copy the KEY ID and KEY into `.env` file
- List down channels you want to scrape inside `.env` separated by comma.

###Usage

Starting: `# npm start`
Stopping: `# npm stop`