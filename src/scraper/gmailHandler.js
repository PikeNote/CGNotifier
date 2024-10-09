//const {google} = require('googleapis');

const verificationCodeRegex = /The sign-in code you requested for CampusGroups is ([0-9]{6})/i
require('dotenv').config();
const Imap = require('imap')

let mailServer1 = new Imap({
  user: process.env.GMAIL_EMAIL,
  password: process.env.GMAIL_APP_PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false
  },
  authTimeout: 3000,
  keepalive: true
}).once('error', function (err) {
  console.log('Source Server Error:- ', err);
});

mailServer1.once('ready', async function () {
  console.log('Mail Server Ready');
});

async function getVerificationCode(delay) {
  await new Promise(r => setTimeout(r, delay));
  await mailServer1.connect();
  mailServer1.once('ready', async function () {
    let code = await getInboxCode(mailServer1);
    await mailServer1.end();
    return code;
  });
}

async function getInboxCode () {
  return new Promise((resolve, reject) => {
    mailServer1.openBox('INBOX', true, (err, box) => {

      if (err) throw err;
      var f = mailServer1.seq.fetch(box.messages.total + ':*', { bodies: ['HEADER.FIELDS (FROM)','TEXT'] });
      f.on('message', function(msg, seqno) {
        msg.on('body', function(stream, info) {
          var buffer = '', count = 0;
          stream.on('data', function(chunk) {
            count += chunk.length;
            buffer += chunk.toString('utf8');
          });
          stream.once('end', async function() {
            if (info.which === 'TEXT')  {
              var codeRegex = buffer.toString().match(verificationCodeRegex);
              if(codeRegex && codeRegex.length > 1) {
                resolve(codeRegex[1]);
              } else {
                resolve(0);
              }
            }
          });
        });
      });
      f.once('error', function(err) {
        reject(err);
        console.log('Fetch error: ' + err);
      });
    });
  });
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