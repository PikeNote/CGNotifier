const axios = require('axios');
const schedule = require('node-schedule');
const { DateTime } = require("luxon");
const ical = require('node-ical');
const {dbUpdate, getOldMessages, removeMessage, getAllTrackers, insertUpdateMessage, retrieveTagEvents, getPastDueNotifications, getEvent, deleteUserNotification, deleteTracker} = require('./sqliteHelper');
const {embedBuilder,  updateMessage} = require('../bot/utility/eventSender')
const {loginToCG} = require('../scraper/puppeteerLogin');
const {postEvent} = require('../bot/utility/eventHandling');

// Initalize dotenv environent
require('dotenv').config()

// Save me wtf is this
const regexMultiDate = /(?:[A-Za-z]+), ([A-Za-z]+) ([0-9]+), ([0-9]+) ([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+)/gm;
const regexOneDate = /(?:[A-Za-z]+), ([A-Za-z]+) ([0-9]+), ([0-9]{4})([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+) - ([0-9]+)(?:[:]{0,1}?)(?:([0-9]+)?) ([A-Za-z]+)/gm
const caseURLRegex = /https:\/\/community\.case\.edu\/rsvp\?id=([0-9]+)/gm;
const descriptionCleaner = /. . . . /gm

let updateLock = false;
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
    if(!updateLock) {
        console.log('Refreshing event DB, pruning messages, and posting new events!');
        updateLock = true;
        await getEventData(force);
        await messagePruner();
    } else {
        console.log("Attempted update but update lock still true")
    }
    
}

const axiosHeader = {
    'Cookie': process.env.COOKIE_HEADER,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0'
}

async function getEventData(force = false) {
    console.log('Getting event data...')
    events_storage = {};

    try {
        const events = await ical.fromURL(`https://community.case.edu/ical/cwru/ical_cwru.ics?timestamp=${new Date().getTime()}`, {headers: axiosHeader});
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

        console.log("iCal Fetched")
        await getEventDataRQ(force);
    } catch (e) {
        console.log(e);
        console.log("iCal Fetching Failed") 
    }
}

async function getEventDataRQ(force = false) {
    console.log("Getting main API")
    let currentDate = DateTime.now();

    axios({
        method: 'get',
        url:  `https://community.case.edu/mobile_ws/v17/mobile_events_list?range=0&limit=1000&filter4_contains=OR&timestamp=${new Date().getTime()}&filter8=${currentDate.day} ${currentDate.monthShort} ${currentDate.year}&filter4_notcontains=OR&order=undefined&search_word=&&1726272567036`,
        responseType: 'json',
        headers: axiosHeader
    }) .then (async (response) => {
       console.log('Fetched event data from ' + `https://community.case.edu/mobile_ws/v17/mobile_events_list?range=0&limit=1000&filter4_contains=OR&timestamp=${new Date().getTime()}&filter8=${currentDate.day} ${currentDate.monthShort} ${currentDate.year}&filter4_notcontains=OR&order=undefined&search_word=&&1726272567036`)

      let cancelUpdate = false; 
      for(const [key, event] of Object.entries(response.data)) {
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
            const convertedDate = await stringDateConverter(temp_data["eventDates"]);
            
            // Handle events that don't have a date;
            if(convertedDate[0] == null) {
                continue;
            }
            // Skip old events  
            if(new Date(convertedDate) < new Date()) {
                continue;
            }

            let event_data = await fetchEventDesc(temp_data["eventId"]);

            if(event_data == null){
                event_data = {
                    "start_time":convertedDate[0],
                    "end_time":convertedDate[1],
                    "eventName":temp_data["eventName"],
                    "eventDesc": "https://community.case.edu" + temp_data["eventUrl"],
                    "eventAttendees":temp_data["eventAttendees"],
                    "eventUrl": "https://community.case.edu" + temp_data["eventUrl"],
                    "eventLocation":temp_data["eventLocation"],
                    "eventPicture":("https://community.case.edu" + temp_data["eventPicture"]).replace('r2_image_upload','r3_image_upload'),
                    "eventPriceRange":temp_data["eventPriceRange"],
                    "clubName":temp_data["clubName"],
                    "clubURL":"",
                    "eventId":temp_data["eventId"],
                    "eventCategory": JSON.stringify(temp_data["eventCategory"])
                }
                
            }
            events_storage[temp_data["eventId"]] = event_data;
        } else {
            events_storage[temp_data["eventId"]]["eventPriceRange"] = temp_data["eventPriceRange"];
            events_storage[temp_data["eventId"]]["eventPicture"] = ("https://community.case.edu" + temp_data["eventPicture"]).replace('r2_image_upload','r3_image_upload');
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
      updateLock = false;
      if(!cancelUpdate) {
        console.log("Processing done!")
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
        updateLock = false;
    });
}


async function updateDB(force = false) {
    Object.entries(events_storage).forEach(async ([key,value]) => {
        let messagesToUpdate = await dbUpdate(value, force);
        
        for(let i=0; i<messagesToUpdate.length; i++) {

            let newData = await updateMessage(value, messagesToUpdate[i]["channelID"], messagesToUpdate[i]["messageID"]);
            if(newData.length > 0) {
                await insertUpdateMessage(newData[0], newData[1], newData[2], newData[3], newData[4], newData[5])
            }
        }
    });
    console.log("Database updated!")
}


// Takes an input date given by the CG API to convert it to a DateTime;
async function stringDateConverter(input) {
    const singleDayMatch = [...input.matchAll(regexOneDate)];

    if(singleDayMatch.length > 0) {
        const singleMatch = singleDayMatch[0]
        return [DateTime.fromFormat(`${singleMatch[1]} ${singleMatch[2]} ${singleMatch[3]} ${singleMatch[4]} ${singleMatch[5] ?? '00'} ${singleMatch[6]}`, 'MMM d yyyy h m a', {zone:'America/New_York'}).toUTC().toISO(),
        DateTime.fromFormat(`${singleMatch[1]} ${singleMatch[2]} ${singleMatch[3]} ${singleMatch[7]} ${singleMatch[8] ?? '00'} ${singleMatch[9]}`, 'MMM d yyyy h m a', {zone:'America/New_York'}).toUTC().toISO()];
    } else {
        const multiDateMatch = [...input.matchAll(regexMultiDate)];
        if(multiDateMatch.length > 1) {
            const matchOne = multiDateMatch[0];
            const matchTwo = multiDateMatch[1];

            return [DateTime.fromFormat(`${matchOne[1]} ${matchOne[2]} ${matchOne[3]} ${matchOne[4]} ${matchOne[5] ?? '00'} ${matchOne[6]}`, 'MMM d yyyy h m a', {zone:'America/New_York'}).toUTC().toISO(),
            DateTime.fromFormat(`${matchTwo[1]} ${matchTwo[2]} ${matchTwo[3]} ${matchTwo[4]} ${matchTwo[5] ?? '00'} ${matchTwo[6]}`, 'MMM d yyyy h m a', {zone: 'America/New_York'}).toUTC().toISO()];
        } else{
            return [];
        }
    }
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
                let em = await embedBuilder(result[ii]);
                channel.send(em).then(msg => {
                    insertUpdateMessage(msg.id, msg.channelId, result[ii]["eventId"], JSON.stringify(result[ii]), result[ii]["end_time"]);
                    if(result[ii]['postEvent'] == 1) {
                        postEvent(interaction.guild, result[ii], `Generated by tracker ID #${rows[i]['id']}`);
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 500)); 
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
                user.send(`**${event['eventName']}** is starting in 30 minutes!\n(Start time: ${DateTime.fromISO(event['start_time']).setZone("America/New_York").toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })})\n${event['eventUrl']}\n
                    Event Location: ${event['eventLocation']}
                `).catch(e => [

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

async function fetchEventDesc(event_id, secondAttempt=false) {
    return new Promise(resolve => {
        axios({
            method: 'get',
            url:  `https://community.case.edu/mobile_ws/v18/mobile_event_new?id=${event_id}`,
            responseType: 'json',
            headers: axiosHeader
        }) .then (async (response) => { 
            responseData = response.data;
            let eventTags = [];
            for (let i=0; i< responseData['event_tags'].length; i++) {
                eventTags.push(responseData['event_tags'][i]['name']);
            }
            let event_data = {
                "start_time":responseData['event_start_utc'],
                "end_time":responseData['event_end_utc'],
                "eventName":responseData['eventName'],
                "eventDesc":responseData['event_description'],
                "eventAttendees":responseData['attendees_count'],
                "eventUrl": `https://community.case.edu/rsvp?id=${responseData['event_id']}`,
                "eventLocation":responseData['location'].split(',')[0],
                "eventPicture":("https://community.case.edu" + responseData['photo_url']),
                "eventPriceRange":"FREE",
                "clubName":responseData['eventGroup']['groupName'],
                "clubURL":"",
                "eventId":responseData['event_id'],
                "eventCategory": JSON.stringify(eventTags)
            }

            resolve(event_data);
        }).catch((e) => {
            console.log("Error while fetching:" + e);
            resolve(null);
        });
    });
}

module.exports = {updateInfo};