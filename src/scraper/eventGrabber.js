const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require("luxon");
const ical = require('node-ical');
const {dbUpdate, getOldMessages, removeMessage, getAllTrackers, insertUpdateMessage, retrieveTagEvents, getPastDueNotifications, getEvent, deleteUserNotification, deleteTracker} = require('./sqliteHelper');
const {embedBuilder} = require('../bot/utility/eventSender')
const {loginToCG} = require('../scraper/puppeteerLogin');
const {postEvent} = require('../bot/utility/eventHandling');
// Initalize dotenv environent
require('dotenv').config()

// Save me wtf is this
const regexMultiDate = /(?:[A-Za-z]+), ([A-Za-z]+) ([0-9]+), ([0-9]+) ([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+)/gm;
const regexOneDate = /(?:[A-Za-z]+), ([A-Za-z]+) ([0-9]+), ([0-9]+) ([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+) – ([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+)/gm
const caseURLRegex = /https:\/\/community\.case\.edu\/rsvp\?id=([0-9]+)/gm;
const descriptionCleaner = /. . . . /gm
let failed = false;

const job = schedule.scheduleJob('*/10 * * * *', () => {
    failed = false;
    updateInfo();
});

const notificationCheck = schedule.scheduleJob('* * * * *', () => {
    processNotifications();
});

const autoTagger = {
    "Food": {
        "keywords" : ["food","lunch","luncheon","bbq","ice cream", "dessert", "lunch", "breakfast", "muffin", "delicious", "shawarma", "ice cream", "bbq", "barbeque", "taco", "pizza", "boba", "cake", "donut", "chocolate"],
        "counterkeywords": ["volunteer"]
    }
}

let events_storage = {};

//postnewTrackers();
//messagePruner();
//getEventData(false);

//updateInfo();

async function updateInfo(force = false) {
    console.log('Refreshing event DB, pruning messages, and posting new events!');
    await getEventData(force);
    await messagePruner();
}

async function getEventData(force = false) {
    console.log('Getting event data...')
    events_storage = {};

    try {
        const events = await ical.fromURL("https://community.case.edu/ical/cwru/ical_cwru.ics");
        for (const event of Object.values(events)) {

            
            if(!event.url) {
                continue;
            }
            
            const caseURLMatch = [...(event.url).matchAll(caseURLRegex)];

            // Set the event ID for future storage
            if(!caseURLMatch.length > 0)
                continue;
            
            // Skip events that literally don't exist;
            if(event.end < new Date()) {
                continue;
            }

            let event_data = {
                "start_time":event.start.toISOString(),
                "end_time":event.end.toISOString(),
                "eventName":event.summary.val,
                "eventDesc":event.description.replace(descriptionCleaner, '\n\n'),
                "eventAttendees":0,
                "eventUrl":event.url,
                "eventLocation":event.location,
                "eventPicture":"",
                "eventPriceRange":"FREE",
                "clubName":event.organizer.params.CN,
                "clubURL":event.organizer.val,
                "eventId":caseURLMatch[0][1],
                "eventCategory":JSON.stringify(event.categories)
            }

            events_storage[event_data.eventId] = event_data;
        }


        await getEventDataRQ(force);
    } catch (e) {
        console.log(e);
        console.log("iCal Fetching Failed") 
    }
}

async function getEventDataRQ(force = false) {
    let currentDate = DateTime.now();
    axios({
        method: 'get',
        url:  `https://community.case.edu/mobile_ws/v17/mobile_events_list?range=0&limit=1000&filter4_contains=OR&filter8=${currentDate.day} ${currentDate.monthShort} ${currentDate.year}&filter4_notcontains=OR&order=undefined&search_word=&&1726272567036`,
        responseType: 'json',
        headers: {
            'Cookie': process.env.COOKIE_HEADER,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    }) .then ((response) => {
       console.log('Fetched event data!')

      let cancelUpdate = false; 
      for(const event of response.data) {
        const fields = event["fields"].split(',').filter(n => n);

        // Don't continue if it is a separator/divider
        if(fields.length < 10) {
            continue;
        }



        let temp_data = {

        }

        for(var i=0; i<fields.length; i++) {{
            temp_data[fields[i]] = event[`p${i}`];
        }}

        


        temp_data["eventDates"] = temp_data["eventDates"].replaceAll(/(<([^>]+)>)/ig, "");
        temp_data["eventDates"] = temp_data["eventDates"].replace("&ndash;", "-");
        temp_data["eventCategory"] = temp_data["eventCategory"].replace(/(<([^>]+)>)/ig, '\n').split('\n').filter(i => i);
        
        if(temp_data["eventLocation"].includes("sign in to display")) {
            cancelUpdate = true;
            break;
        } else {
            // Failed
            failed = false;
        }

        if(!events_storage.hasOwnProperty(temp_data["eventId"])) {
            const convertedDate = dateConverter(temp_data["eventDates"]);
            // Skip old events
            if(new Date(convertedDate) < new Date()) {
                continue;
            }
            let event_data = {
                "start_time":convertedDate[0],
                "end_time":convertedDate[1],
                "eventName":temp_data["eventName"],
                "eventDesc":"",
                "eventAttendees":temp_data["eventAttendees"],
                "eventUrl": "https://community.case.edu/placeholder" + temp_data["eventURL"],
                "eventLocation":temp_data["eventLocation"],
                "eventPicture":"https://community.case.edu" + temp_data["eventPicture"],
                "eventPriceRange":temp_data["eventPriceRange"],
                "clubName":temp_data["clubName"],
                "clubURL":"",
                "eventId":temp_data["eventId"],
                "eventCategory": JSON.stringify(temp_data["eventCategory"])
            }
            events_storage[temp_data["eventId"]] = event_data;
        } else {
            events_storage[temp_data["eventId"]]["eventPriceRange"] = temp_data["eventPriceRange"];
            events_storage[temp_data["eventId"]]["eventPicture"] = "https://community.case.edu" + temp_data["eventPicture"];
            events_storage[temp_data["eventId"]]["eventName"] = temp_data["eventName"];
            events_storage[temp_data["eventId"]]["eventAttendees"] = temp_data["eventAttendees"];
            events_storage[temp_data["eventId"]]["eventLocation"] = temp_data["eventLocation"];
        }

        let parsedEvents = JSON.parse(events_storage[temp_data["eventId"]]["eventCategory"]);
        for(const [key, arr] of Object.entries(autoTagger)) {
            if(!parsedEvents.includes(key)) {
                let keyRegex = new RegExp(arr["keywords"].join('|'), 'i');
                let cctKeyRegex = new RegExp(arr["counterkeywords"].join('|'), 'i');

                let eventDesc = events_storage[temp_data["eventId"]]["eventDesc"].toLowerCase();

                // Test for counterkey regex alongside primary test key regex
                if(keyRegex.test(eventDesc) && !cctKeyRegex.test(eventDesc) && !cctKeyRegex.test(events_storage[temp_data["eventId"]]["eventCategory"])) {
                    parsedEvents.push(key);
                }
                
            }
            
        }

        events_storage[temp_data["eventId"]]["eventCategory"] = JSON.stringify(parsedEvents);

        
      }

      if(!cancelUpdate) {
        updateDB(force);
        postnewTrackers();
      } else {
        if(!failed){
            failed = true;
            client.users.fetch('141382611518881792', false).then((user) => {
                user.send('Attempting to refresh via logging into CG!');
            });
    
            loginToCG((success) => {
                if(success) {
                    updateInfo();
                } 
            });
        }
      }
    }) .catch(function (error) { 
        console.log(error);
    });
}


function updateDB(force = false) {
    for(const [key, value] of Object.entries(events_storage)) {
        dbUpdate(value, force);
    }
    console.log("Database updated!")
}


// Takes an input date given by the CG API to convert it to a DateTime;
async function dateConverter(input) {
    const singleDayMatch = [...input.matchAll(regexOneDate)];

    if(singleDayMatch.length > 0) {
        const singleMatch = singleDayMatch[0]
        return [isoString(DateTime.fromFormat(`${singleMatch[1]} ${singleMatch[2]} ${singleMatch[3]} ${singleMatch[4]} ${singleMatch[5]} ${singleMatch[6]}`, 'MMM d yyyy h m a').toISO()),
        isoString(DateTime.fromFormat(`${matchTwo[1]} ${matchTwo[2]} ${matchTwo[3]} ${matchTwo[4]} ${matchTwo[5]} ${matchTwo[6]}`, 'MMM d yyyy h m a').toISO())];
    } else {
        const multiDateMatch = [...input.matchAll(regexMultiDate)];
        if(multiDateMatch.length > 1) {
            const matchOne = multiDateMatch[0];
            const matchTwo = multiDateMatch[1];
            return [DateTime.fromFormat(`${matchOne[1]} ${matchOne[2]} ${matchOne[3]} ${matchOne[4]} ${matchOne[5]} ${matchOne[6]}`, 'MMM d yyyy h m a').toISO(),
            DateTime.fromFormat(`${matchOne[1]} ${matchOne[2]} ${matchOne[3]} ${matchTwo[7]} ${matchTwo[8]} ${matchTwo[9]}`, 'MMM d yyyy h m a').toISO()];
        }
    }

    return [];
}

// Prune old messages
async function messagePruner() {
    let rows = await getOldMessages();
    for(let i=0; i<rows.length; i++) {
        try {
            const channel = await global.client.channels.fetch(rows[i]["channelID"])

            const message = await channel.messages.fetch(rows[i]["messageID"])
            message.delete();
            removeMessage(rows[i]["messageID"]);
        } catch (e) {
            removeMessage(rows[i]["messageID"])
        }
    }
}

async function postnewTrackers() {
    console.log('Updating trackers...')
    let rows = await getAllTrackers();
    console.log('Going through all channels...')
    for(let i=0; i<rows.length; i++) {
        global.client.channels.fetch(rows[i]["channelID"]).then(async (channel) => {
            let result = await retrieveTagEvents(rows[i]["tagFilter"],rows[i]["clubFilter"],rows[i]["daysPost"],rows[i]["channelID"]);
            result = result.slice(0, 15);
            for(let ii=0; ii<result.length; ii++) {
                channel.send(embedBuilder(result[ii])).then(msg => {
                    insertUpdateMessage(msg.id, msg.channelId, result[ii]["eventId"], JSON.stringify(result[ii]), result[ii]["end_time"]);
                    if(result[ii]['postEvent'] == 1) {
                        postEvent(interaction.guild, result[ii], `Generated by tracker ID #${rows[i]['id']}`);
                    }
                })
            }
            
        }).catch(e => {
            if(e.code == 10008) {
                deleteTracker(rows[i]["id"]);
            } else {
                console.error(e);
            }
            
            //console.warn(e);
        })   
    }
}

async function processNotifications() {
    let notifs = await getPastDueNotifications();

    for(let i=0; i<notifs.length; i++) {
        try {
            let event = await getEvent(notifs[i]["eventID"]);
            let user = await global.client.users.fetch(notifs[i]['userID'])
            
            if(user != null && event.length != 0) {
                event = event[0];
                user.send(`${event['eventName']} is starting in 30 minutes! (Start time: ${DateTime.fromISO(event['start_time']).setZone("America/New_York").toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })})\n${event['eventUrl']}`).catch(e => [

                ])

                user.dmChannel.fetch(notifs[i]['messageId']).then((oldNotif) => {
                    oldNotif.delete();
                }).catch((e) => {
                    console.warn("Couldn't find message " + notifs[i]['messageId']);
                })

                deleteUserNotification(notifs[i]['messageId']);
            }
        } catch (e) {
            deleteUserNotification(notifs[i]['messageId']);
        }
        
        
    }
}

module.exports = {updateInfo};