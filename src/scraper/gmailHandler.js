const {google} = require('googleapis');

require('dotenv').config()

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    'https://developers.google.com/oauthplayground'
  );

const verificationCodeRegex = /[0-9+]{6}/gm

// Load token or redirect to auth URL
auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({version: 'v1', auth});

//const accessToken = oauth2Client.getAccessToken()

async function getVerificationCode(delay) {
  await new Promise(r => setTimeout(r, delay));

  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 1
  });

  const messages = res.data.messages;

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messages[0].id
  });

  let codeRegex = await msg.data.snippet.match(verificationCodeRegex);

  if(codeRegex.length > 0) {
    return codeRegex[0];
  } else {
    return 0;
  }
  

}


module.exports = {getVerificationCode};