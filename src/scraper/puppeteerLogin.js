const puppeteer = require("puppeteer-extra");
const fs = require('fs');
const os = require('os');
const {getVerificationCode} = require('./gmailHandler')
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const dotenv = require('dotenv');
puppeteer.use(StealthPlugin())


dotenv.config();

loginToCG();

// Alternative CG login directly via SSO
/*
async function loginToCG(callback=(()=>{}), justLogin=false) {
    if(browser == null) {
      browser = await puppeteer.launch({
        headless: true,
        devtools: false,
        args: ['--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-infobars',
              '--window-position=0,0',
              '--ignore-certifcate-errors',
              '--ignore-certifcate-errors-spki-list',
              '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"']
      });
    }

    console.log("Logging into CampusGroups")
    // Launch the browser and open a new blank page
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://www.campusgroups.com/shibboleth/login?idp=cwru', {timeout: 0});

    await page.setCacheEnabled(false);

    await page.waitForNetworkIdle();

    await page.waitForSelector('#username')
    await page.waitForSelector('#password')
    await page.waitForSelector('#login-submit')

    await delay(1000);

    await page.type("#username", process.env.LOGIN_USER);
    await page.type("#password", process.env.LOGIN_PASSWORD);
    await page.click("#login-submit");

    await page.waitForNetworkIdle();

    if(!justLogin) {
      await page.waitForSelector('.list-unstyled > li:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)', { visible: true, timeout: 30000 }) .catch(error => {
        console.log("Could not load webpage! May be duo?")
      });

      const client = await page.target().createCDPSession();
      const cookies = (await client.send('Network.getAllCookies')).cookies;

      const updatedCookie = `TGC=${cookies[0]['value']};CG.SessionID=${cookies[9]['value']}`

      setEnvValue('COOKIE_HEADER', updatedCookie);
    }
    
    await page.close();
    callback(true);
}
*/

const reloadEnv = () => {
  const envConfig = dotenv.parse(fs.readFileSync('.env'))

  for (const key in envConfig) {
      process.env[key] = envConfig[key]
  }
}

function processCookies() {
  let cookies = process.env.COOKIE_HEADER;
  let cookies_array = [];
  cookies = cookies.split(';');
  console.log(cookies);
  for(let i=0; i<cookies.length; i++) {

    let cookie_part = cookies[i].split('=');
    
    cookies_array.push({
      'domain': 'community.case.edu',
      'name': cookie_part[0],
      'value': cookie_part[1]
    })
    
    
  }
  console.log(cookies_array);
  return cookies_array;
}

async function createBrowser() {
  return new Promise(async(resolve,reject) => {
    try {
      
      let cookies = processCookies();

      let browser = await puppeteer.launch({
        headless: true,
        devtools: false,
        args: ['--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-infobars',
              '--window-position=0,0',
              '--ignore-certifcate-errors',
              '--ignore-certifcate-errors-spki-list',
              '--user-agent="Mozilla/5.0 (Windows; Windows NT 10.5; x64) Gecko/20130401 Firefox/69.1"']
      });

      const page = await browser.newPage();

      await page.setCookie(...cookies);

      resolve(browser);
    } catch (e) {
      reject(e);
    }


  })
  
}

async function loginToCG(callback=(()=>{}), justLogin=false, browser=null) {
  if(!browser) {
    browser = await createBrowser();
    if(!browser){
      callback(false);
      return;
    }
  }

  try {
  
    console.log("Logging into CampusGroups")
    // Launch the browser and open a new blank page
    const page = await browser.newPage();
  
    // Navigate the page to a URL.
    await page.goto('https://community.case.edu/', {timeout: 0});
  
    await page.setCacheEnabled(false).catch();
  
    await page.waitForNetworkIdle();
  
  
    const url_page = await page.url();
  
    if(!url_page.includes('https://community.case.edu/home_login')) {
      console.log("Already logged in; Current URL: " + url_page);
      await browser.close();
      callback(true);
      return;
    }
  
    console.log('Going to login page...')
    await page.goto('https://community.case.edu/login_only', {timeout: 0});
  
    await page.waitForNetworkIdle();
  
    await page.waitForSelector('#login_email');
    await delay(1000);
    
    await page.click("#a-all-others-sign-in-below");
    
    await page.type("#login_email", process.env.GMAIL_EMAIL);
    await page.click("#remember_me");
  
    console.log('Filled out data and logging in')
    await page.click("#loginButton");
  
    
  
    await page.waitForNavigation()
  
    await page.waitForNetworkIdle();
  
    await page.waitForSelector('#otp');
    await page.waitForSelector('#otb_button');
    
    console.log('Awaiting OTP...')
    
    let verificationCode = await getVerificationCode(3000);
  
    if(verificationCode != 0) {
      await page.type('#otp', verificationCode);
      console.log("Typing OTP: " + verificationCode)
      await page.click('#otb_button');
    }  else {
      console.log("Login failed.");
      callback(false);
      await browser.close();
      return;
    }
  
    await page.waitForNetworkIdle();
    await page.waitForSelector('.list-unstyled > li:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > h2:nth-child(1)').catch(async(err) => {
      console.log("Login failed.");
      callback(false);
      await browser.close();
      return;
    })
  
    if(!justLogin) {
      const client = await page.target().createCDPSession();
      const cookies = (await client.send('Network.getAllCookies')).cookies;
      let updatedCookieStr = [];
      for (let i=0; i<cookies.length; i++) {
        updatedCookieStr.push(cookies[i]['name'] + "=" + cookies[i]['value']);
      }
  
      const updatedCookie = updatedCookieStr.join(';')
  
      setEnvValue('COOKIE_HEADER', updatedCookie);
      process.env.COOKIE_HEADER = updatedCookie;
  
      require('dotenv').config({ override: true });
      reloadEnv();
    }
    console.log("Login Yipieee")
    await browser.close();
    callback(true);
  } catch {
    await browser.close();
    callback(false);
  }
}

function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

// .env editor; Copied from:
// https://stackoverflow.com/questions/64996008/update-attributes-in-env-file-in-node-js
function setEnvValue(key, value) {
    // read file from hdd & split if from a linebreak to a array
    const ENV_VARS = fs.readFileSync(".env", "utf8").split(os.EOL);
  
    // find the env we want based on the key
    const target = ENV_VARS.indexOf(ENV_VARS.find((line) => {
      // (?<!#\s*)   Negative lookbehind to avoid matching comments (lines that starts with #).
      //             There is a double slash in the RegExp constructor to escape it.
      // (?==)       Positive lookahead to check if there is an equal sign right after the key.
      //             This is to prevent matching keys prefixed with the key of the env var to update.
      const keyValRegex = new RegExp(`(?<!#\\s*)${key}(?==)`);
  
      return line.match(keyValRegex);
    }));
  
    // if key-value pair exists in the .env file,
    if (target !== -1) {
      // replace the key/value with the new value
      ENV_VARS.splice(target, 1, `${key}='${value}'`);
    } else {
      // if it doesn't exist, add it instead
      ENV_VARS.push(`${key}='${value}'`);
    }
  
    // write everything back to the file system
    fs.writeFileSync(".env", ENV_VARS.join(os.EOL));
  }

async function grabDescTags(url, browser=null) {
  console.log("Grabbing info from: " + url);

  if(!browser) {
    await createBrowser();
    if(!browser){
      return null;
    }
  }

  const page = await browser.newPage();
  

  // Navigate the page to a URL.
  await page.goto(url, {timeout: 20000}).catch((res) => {
    return null;
  });

  await page.waitForNetworkIdle().catch((res) => {
    return null;
  });
  
  const url_page = await page.url();

  if(!url_page.includes('https://community.case.edu/otp_signup')) {
    let test = await page.url();

    try{
      await page.waitForSelector('.rsvp__event-tags').catch(e => {
        console.warn(e);
        return null;
      })
      


      const preProcessTaglist = await page.evaluate(() => {return Array.from(document.querySelectorAll('.rsvp__event-tags')).map(el => Array.from(el.children).map(elm =>  Array.from(elm.children).map(elem => elem.innerText)))});
      let tagList = [];
      for(let i=0; i<preProcessTaglist[0].length; i++) {
        tagList.push(preProcessTaglist[0][i][0]);
      }

      let desc = await page.evaluate(() => { return document.querySelector('#event_details > div:nth-child(1)').innerText});
      const new_url = await page.url();

      await page.close();
      desc = desc.split('\n')
      desc.pop();
      desc.shift();
      desc = desc.join('\n');
      return [tagList, desc, new_url]
    } catch {
      return null;
    }
  } else {
    await page.close();
    let succ = false;
    await loginToCG((success) => succ = success, true, browser);

    if(succ){ 
      return grabDescTags(url, browser);
    } else {
      return null;
    }
    

    
    
  }
  
  
}

module.exports = {loginToCG, grabDescTags, createBrowser}