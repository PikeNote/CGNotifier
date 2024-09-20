<h1 align="center">CG Notifier</h1>
<p align="center">
  <i>Discord Bot to help you become more engaged on campus with on-time notifications and events happening around campus!</i>
  <br></br>
<img  src="https://raw.githubusercontent.com/PikeNote/CGNotifier/refs/heads/master/assets/logo.png"  alt="alt text"  width="whatever"  height="200" width="200"></img>

 </p>
 
---

<p align="center">
 <img src="https://raw.githubusercontent.com/PikeNote/CGNotifier/4c0ac1a58ab3d203a7a2dc5ae93f358f9b29a11f/assets/showcase.jpg" alt="Showcase" width="50%"/>
</p>


## 🎯 Features
* 🔴 Live update of messages on a regular 10-minute interval to ensure up to date status
* 📜 Create trackers to automatically post events containing certain tags
* 📅 Add to Discord server events with automatically filled out time
* 💻 Add events to your calendar through a single click
* 🔔 Notify you of events 30 minutes in advance to make sure you know it is coming up!
* 📇 Follow your favorite clubs or tags to ensure you get the latest updates!

## Built Upon
- Node.JS v20.17.0
- [Discord.JS](https://github.com/discordjs/discord.js) - Primary front-end communication with the Discord API
- [node-ical](https://www.npmjs.com/package/node-ical) - Calendar processing and parsing
- [puppeteer](https://github.com/puppeteer/puppeteer) - Web scraping and data collection
- [puppeteer-extra](https://github.com/berstend/puppeteer-extra/tree/master) - Extensions for extra features
- [sqlite](https://github.com/kriasoft/node-sqlite) - Backend database for event storage
- [luxon](https://github.com/moment/luxon) - Time management and processing
- [google-apis](https://github.com/googleapis/google-api-nodejs-client) - Gmail client and OTP login
- [axios](https://github.com/axios/axios) - HTTP Request Client
## Invite The Bot
This bot is hosted for free for anyone to use with all current features. Currently it is still under construction but a publicly hosted version of the bot will available at some point in the future

## Contribution
Feel free to suggest any new ideas or anything that you would like to see added. Not everything suggested will be added based on complexity and how much time any contributor or myself have on maintaing the project.

## General .env Structure
The bot requires couple of environmental variables set up on start up in the .env file to allow all features to work properly.  
  
`DISCORD_TOKEN` - Discord token for the bot to login with   
`CLIENT_ID` - Discord bot client ID  
`GOOGLE_CLIENT_ID` - Google OAUTH client_id for OTP emails from CampusGroups 
`GOOGLE_SECRET` - Google OAUTH secret  
`GOOGLE_REFRESH_TOKEN` - Google OAUTH refresh token  
`GMAIL_EMAIL` - Gmail address of the secondary email on the account and where the OTP code is sent to  



