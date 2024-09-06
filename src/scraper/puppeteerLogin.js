const puppeteer = require("puppeteer");
const fs = require('fs');
const os = require('os');

require('dotenv').config()

async function loginToCG(callback) {
    console.log("Logging into CampusGroups")
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({
        headless: false,
        devtools: false,
        args: ['--no-sandbox', '--incognito']
    });
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto('https://www.campusgroups.com/shibboleth/login?idp=cwru', {timeout: 0});

    await page.waitForNavigation({
        waitUntil: 'networkidle0',
      });

    await page.type("#username", process.env.LOGIN_USER);
    await page.type("#password", process.env.LOGIN_PASSWORD);
    await page.click("#login-submit");

    await page.waitForSelector('.list-unstyled > li:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)', { visible: true, timeout: 10000 }) .catch(error => {
        console.log("Could not load webpage! May be duo?")
    });

    const client = await page.target().createCDPSession();
    const cookies = (await client.send('Network.getAllCookies')).cookies;

    const updatedCookie = `_hjSessionUser_2954518=${cookies[0]['value']};CG.SessionID=${cookies[9]['value']}`

    setEnvValue('COOKIE_HEADER', updatedCookie);

    await browser.close();
    callback(true);
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
      ENV_VARS.splice(target, 1, `${key}=${value}`);
    } else {
      // if it doesn't exist, add it instead
      ENV_VARS.push(`${key}=${value}`);
    }
  
    // write everything back to the file system
    fs.writeFileSync(".env", ENV_VARS.join(os.EOL));
  }

module.exports = {loginToCG}