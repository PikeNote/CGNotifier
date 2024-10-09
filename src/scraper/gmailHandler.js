//const {google} = require('googleapis');

const verificationCodeRegex = /The sign-in code you requested for CampusGroups is ([0-9]{6})/i
require('dotenv').config();
const { ImapFlow } = require('imapflow');

const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
      user: myMail,
      pass: myPwd
  },
  logger: false
});


async function getVerificationCode(delay) {
  await new Promise(r => setTimeout(r, delay));
  let returnCode = 0;
  await client.connect();

  let lock = await client.getMailboxLock('INBOX');
  try {
      let message = await client.fetchOne(client.mailbox.exists, { source: true });
      let textmsg = message.source.toString();

      var codeRegex = textmsg.match(verificationCodeRegex);
      if(codeRegex && codeRegex.length > 1) {
        returnCode = codeRegex[1];
      }
  } finally {
      lock.release();
  }

  await client.logout();
  return returnCode;
}



/*
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SECRET,
    'https://developers.google.com/oauthplayground'
  );

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

*/

module.exports = {getVerificationCode};