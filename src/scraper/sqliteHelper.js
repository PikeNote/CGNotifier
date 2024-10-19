const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const {DateTime} = require('luxon');
let activeTrackerIDs = [];
let clubsList = [];

let db;

/*
Example Data:
    let event_data = {
        "start_time":isoString(event.start.toISOString()),
        "end_time":isoString(event.end.toISOString()),
        "eventName":"",
        "eventDesc":event.description,
        "eventAttendees":0,
        "eventUrl":event.url,
        "eventLocation":event.location,
        "eventPicture":"",
        "eventPriceRange":0,
        "clubName":event.organizer.params.CN,
        "clubURL":event.organizer.val,
        "eventId":caseURLMatch[0][1],
        "eventCategory":event.categories
    }
*/

const initSQLTable = `
    CREATE TABLE IF NOT EXISTS events (
        eventId INTEGER PRIMARY KEY,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        eventName TEXT NOT NULL,
        eventDesc TEXT NOT NULL,
        eventAttendees INTEGER,
        eventUrl TEXT NOT NULL,
        eventLocation TEXT NOT NULL,
        eventPicture TEXT NOT NULL,
        eventPriceRange TEXT NOT NULL,
        clubName TEXT NOT NULL,
        clubURL TEXT NOT NULL,
        eventCategory TEXT NOT NULL

    )`;

const initMessageTable = `
    CREATE TABLE IF NOT EXISTS messages (
        messageID TEXT PRIMARY KEY,
        channelID TEXT NOT NULL,
        eventId INTEGER NOT NULL,
        expiryDate TEXT NOT NULL,
        liveStatus INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(eventId) REFERENCES events(eventId)
    )`;

const serverSettings = `
    CREATE TABLE IF NOT EXISTS trackers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trackerName TEXT NOT NULL,
        guildID TEXT NOT NULL,
        channelID TEXT NOT NULL,
        clubFilter TEXT NOT NULL,
        daysPost TEXT NOT NULL,
        tagFilter TEXT NOT NULL,
        postEvent INTEGER NOT NULL DEFAULT 0
    )`;

const userNotificationTable = `
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userID TEXT NOT NULL,
        eventID TEXT NOT NULL,
        notifyTime TEXT NOT NULL,
        messageId TEXT NOT NULL
    )
`

async function loadDatabase() {
    db = await open({
        filename: './events.db',
        driver: sqlite3.Database
    });
    
    await db.exec(initSQLTable).then(() => {
        console.log('Event table created successfully');
    }).catch( err => {console.error('Error creating table:', err.message)});

    await db.exec(initMessageTable).then(() => {
        console.log('Messages table created successfully');
    }).catch( err => {console.error('Error creating table:', err.message)});

    await db.exec(serverSettings).then(() => {
        console.log('Server settings table created successfully');
    }).catch( err => {console.error('Error creating table:', err.message)});

    await db.exec(userNotificationTable).then(() => {
        console.log('User notifications table created successfully');
    }).catch( err => {console.error('Error creating table:', err.message)});

    // Setup all known trackers
    setupTrackerIDs();
    getUniqueClubs();
}

loadDatabase();

/*
    let event_data = {
        "start_time":isoString(event.start.toISOString()),
        "end_time":isoString(event.end.toISOString()),
        "eventName":"",
        "eventDesc":event.description,
        "eventAttendees":0,
        "eventUrl":event.url,
        "eventLocation":event.location,
        "eventPicture":"",
        "eventPriceRange":0,
        "clubName":event.organizer.params.CN,
        "clubURL":event.organizer.val,
        "eventd":caseURLMatch[0][1],
        "eventCategory":event.categories
    }
*/


async function dbUpdate(data, force = false) {
    return new Promise(async function(resolve, reject) {
        data = addPrefix(data);
        if(!data.$start_time) {
            resolve([]);
        }
    
        let rows = await db.all(`SELECT * FROM events WHERE eventId = ?`, data.$eventId)
    
        if(rows.length > 0) {
            let query = `SELECT * FROM events WHERE start_time = $start_time AND end_time = $end_time AND eventName = $eventName AND eventDesc = $eventDesc AND eventAttendees = $eventAttendees AND eventUrl=$eventUrl AND eventLocation=$eventLocation AND eventPicture = $eventPicture AND eventPriceRange = $eventPriceRange AND clubName = $clubName AND clubURL = $clubURL AND eventCategory = $eventCategory AND eventId=$eventId`
            let updateRow = await db.all(query, data)
            
            if(updateRow.length == 0 || force) {
                let update = `UPDATE events SET start_time = $start_time, end_time = $end_time, eventName = $eventName, eventDesc = $eventDesc, eventAttendees = $eventAttendees, eventUrl=$eventUrl, eventLocation=$eventLocation, eventPicture = $eventPicture, eventPriceRange = $eventPriceRange, clubName = $clubName, clubURL = $clubURL, eventCategory = $eventCategory WHERE eventId=$eventId`
                await db.run(update, data).catch((error) => {
                    console.error(error);
                })
    
                await db.run(`UPDATE messages SET expiryDate = ? WHERE eventId = ?`, [data.$end_time, data.$eventId]);
    
                let messagesToUpdate = await db.all(`SELECT * FROM messages WHERE eventId = ?`, data.$eventId).catch((error) => {
                    console.error(error);
                })
    
                resolve(messagesToUpdate);
                
            }
            
        } else {
            let query = `INSERT INTO events (eventId,start_time,end_time,eventName,eventDesc,eventAttendees,eventUrl,eventLocation, eventPicture,eventPriceRange,clubName,clubURL,eventCategory) VALUES ($eventId, $start_time, $end_time, $eventName, $eventDesc, $eventAttendees, $eventUrl, $eventLocation, $eventPicture, $eventPriceRange, $clubName, $clubURL, $eventCategory)`
            await db.run(query, data).catch( (error) => console.error(error) )
            resolve([]);
        }
        
        getUniqueClubs();
    });
}


function addPrefix(obj) {
    return Object.keys(obj).reduce((x, y) => ({ ...x, [`$${y}`]: obj[y] }), {});
}

function retrieveEvent(tags, clubName) {
    return db.all(`SELECT * from events WHERE end_time > strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') AND ($tag = '' OR EXISTS (SELECT * FROM json_each(eventCategory) WHERE value IN ($tag) COLLATE NOCASE)) AND ($cname = '' OR clubName=$cname COLLATE NOCASE) ORDER BY start_time`,
        {
            $tag:tags,
            $cname:clubName
        })
}

function retrieveTagEvents(tags, clubName, days, channelID) {
    let dateToLookFor = DateTime.now().plus({ days: days}).toISO();

    return db.all(`SELECT * from events t1 WHERE NOT exists (SELECT 1 FROM messages t2 WHERE t1.eventId = t2.eventId AND $channelID = t2.channelID) AND end_time > strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') AND ($tag = '' OR EXISTS (SELECT * FROM json_each(eventCategory) WHERE value IN ($tag) COLLATE NOCASE)) AND ($cname = '' OR clubName=$cname COLLATE NOCASE) AND $days > end_time ORDER BY start_time`,
        {
            $tag:tags,
            $cname:clubName,
            $days:dateToLookFor,
            $channelID:channelID
        });
}


function insertUpdateMessage(msgID, chnID, eventID, data, expiryDate, liveStatus=0) {
    db.run(`INSERT INTO messages (messageID, channelID, eventId, oldData, expiryDate, liveStatus) VALUES (?, ?, ?, ?, ?, ?);`,
        [msgID, chnID, eventID, data, expiryDate, liveStatus]
    )
}

function insertTracker(trackerName, guildID, chnID, clubFilter, days, tagFilter, postEvent) {

    db.run(`INSERT INTO trackers (trackerName, guildID, channelID, clubFilter, daysPost, tagFilter, postEvent) VALUES (?, ?, ?, ?, ?, ?);`,
        [trackerName, guildID, chnID, clubFilter, days, tagFilter, postEvent]
    )
    setupTrackerIDs();
}

function updateTracker(query, data) {
    db.run(`UPDATE trackers SET ${query.join(", ")} WHERE id=$id`,data)
    setupTrackerIDs();
}

function getOldMessages() {
    return db.all(`SELECT * FROM  messages WHERE expiryDate < strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc');`);
}

function removeMessage(msgID) {
    db.run(`DELETE FROM messages WHERE messageID = ?`, msgID);
}

function deleteTracker(trackerID) {
    db.run(`DELETE FROM trackers WHERE id=?`, trackerID);
    setupTrackerIDs();
}

function getAllTrackers() {
    return db.all(`SELECT * FROM trackers`);
}

function getGuildTrackers(guild) {
    return db.all(`SELECT * FROM trackers WHERE guildID = ?`, guild);
}

function getEvent(id) {
    return db.all(`SELECT * FROM events WHERE eventId = ?`, id);
}

function getEventMessage(id) {
    return db.all(`SELECT * FROM messages WHERE messageID = ?`, id);
}

function getUserNotifications(userId, eventId) {
    return db.all(`SELECT * FROM notifications WHERE eventId = ? AND userId = ?`, [eventId, userId]);
}

function getUserNotificationByMessage(messageID) {
    return db.all(`SELECT * FROM notifications WHERE messageId=?`, messageID);
}

function addUserNotification(userId, eventId, messageId, notifyTime) {
    db.run(`INSERT INTO notifications (userId, eventId, messageId, notifyTime) VALUES (?, ?, ?, ?);`,
        [userId, eventId, messageId, notifyTime]
    )
}

function deleteUserNotification(messageID) {
    db.run(`DELETE FROM notifications WHERE messageId=?`, messageID);
}

function getPastDueNotifications() {
    return db.all(`SELECT * FROM notifications WHERE notifyTime <= strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc');`);
}

async function setupTrackerIDs() {
    activeTrackerIDs = [];
    let trackers = await db.all('SELECT * FROM trackers')
    for(let i=0; i<trackers.length; i++) {
        activeTrackerIDs.push(
            {
                "id":`${trackers[i]["id"]}`, 
                name: trackers[i]["trackerName"], 
                desc:`ID: ${trackers[i]["id"]} ┃┃ Name: ${trackers[i]["trackerName"]}`, 
                guildID: trackers[i]["guildID"], 
                channelID: trackers[i]["channelID"]
            }
        );
    }
    
}

async function getUniqueClubs() {
    clubsList = [];
    let clubs = await db.all('SELECT DISTINCT clubName FROM events')
    for(let i=0; i<clubs.length; i++) {
        clubsList.push(clubs[i]["clubName"])      
    }
    
}

function getClubList() {
    return clubsList;
}

function getTrackerIDs() {
    return activeTrackerIDs;
}



module.exports = { dbUpdate, retrieveEvent, insertUpdateMessage, 
    getOldMessages, removeMessage, getAllTrackers, retrieveTagEvents, insertTracker, 
    getGuildTrackers, getTrackerIDs, getClubList, updateTracker, getEvent, deleteTracker, 
    getEventMessage, getUserNotifications, addUserNotification, getUserNotificationByMessage, deleteUserNotification, getPastDueNotifications}

// TBI


