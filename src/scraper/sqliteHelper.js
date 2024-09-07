const sqlite3 = require('sqlite3').verbose();
const {DateTime} = require('luxon');
const {updateMessage} = require('../bot/utility/eventSender')
let activeTrackerIDs = [];
let clubsList = [];

const db = new sqlite3.Database('./events.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Events database connected owo');
    }
});

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
        FOREIGN KEY(eventId) REFERENCES events(eventId)
    )`;

const serverSettings = `
    CREATE TABLE IF NOT EXISTS trackers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildID TEXT NO NULL,
        channelID TEXT NOT NULL,
        clubFilter TEXT NOT NULL,
        daysPost TEXT NOT NULL,
        tagFilter TEXT NOT NULL
    )`;

const userNotificationTable = `
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userID TEXT NOT NULL,
        eventID TEXT NOT NULL
    )
`

db.run(initSQLTable, (err) => {
    if (err) {
        return console.error('Error creating table:', err.message);
    }
    console.log('Event table created successfully');
});

db.run(initMessageTable, (err) => {
    if (err) {
        return console.error('Error creating table:', err.message);
    }
    console.log('Messages table created successfully');
});

db.run(serverSettings, (err) => {
    if (err) {
        return console.error('Error creating table:', err.message);
    }
    console.log('Server settings table created successfully');
});

db.run(userNotificationTable, (err) => {
    if (err) {
        return console.error('Error creating table:', err.message);
    }
    console.log('User notifications table created successfully');
});


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


function dbUpdate(data, force = false) {
    let copyData = Object.create(data);
    data = addPrefix(data);
    if(!data.$start_time) {
        return;
    }
    db.all(`SELECT * FROM events WHERE eventId = ?`, data.$eventId, (error, rows) => {
        if(rows.length > 0) {
            let query = `SELECT * FROM events WHERE start_time = $start_time AND end_time = $end_time AND eventName = $eventName AND eventDesc = $eventDesc AND eventAttendees = $eventAttendees AND eventUrl=$eventUrl AND eventLocation=$eventLocation AND eventPicture = $eventPicture AND eventPriceRange = $eventPriceRange AND clubName = $clubName AND clubURL = $clubURL AND eventCategory = $eventCategory AND eventId=$eventId`
            db.all(query, data, function (error, rows) {
                if (error) {
                    console.log(error);
                }
                if(rows.length == 0 || force) {
                    let update = `UPDATE events SET start_time = $start_time, end_time = $end_time, eventName = $eventName, eventDesc = $eventDesc, eventAttendees = $eventAttendees, eventUrl=$eventUrl, eventLocation=$eventLocation, eventPicture = $eventPicture, eventPriceRange = $eventPriceRange, clubName = $clubName, clubURL = $clubURL, eventCategory = $eventCategory WHERE eventId=$eventId`
                    db.run(update, data, function (error, rows) {
                        if (error) {
                            console.log(error);
                        }
                    });

                    db.run(`UPDATE messages SET expiryDate = ? WHERE eventId = ?`, [data.$end_time, data.$eventId]);

                    db.all(`SELECT * FROM messages WHERE eventId = ?`, data.$eventId, function (error, rows) {
                        if (error) {
                            console.log(error);
                        }
                        for(let i=0; i<rows.length; i++) {
                            updateMessage(copyData, rows[i]["channelID"], rows[i]["messageID"]);
                        }
                    })
                }
            });
        } else {
            let query = `INSERT OR IGNORE INTO events (eventId,start_time,end_time,eventName,eventDesc,eventAttendees,eventUrl,eventLocation, eventPicture,eventPriceRange,clubName,clubURL,eventCategory) VALUES ($eventId, $start_time, $end_time, $eventName, $eventDesc, $eventAttendees, $eventUrl, $eventLocation, $eventPicture, $eventPriceRange, $clubName, $clubURL, $eventCategory)`
            db.run(query, data, function (error, rows) {
                if (error) {
                    console.log(error);
                }
            });
        }
    })
    getUniqueClubs();
}


function addPrefix(obj) {
    return Object.keys(obj).reduce((x, y) => ({ ...x, [`$${y}`]: obj[y] }), {});
}

function runQuery(query,params) {
    db.all(query, params)(err, rows => {
        return rows;
    });
}

async function retrieveEvent(tags, clubName, callback) {
    db.all(`SELECT * from events WHERE end_time > strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') AND ($tag = '' OR EXISTS (SELECT * FROM json_each(eventCategory) WHERE value IN ($tag) COLLATE NOCASE)) AND ($cname = '' OR clubName=$cname COLLATE NOCASE) ORDER BY start_time`,
        {
            $tag:tags,
            $cname:clubName
        }, (err,rows) => {
        callback(rows);
    }) 
}

async function retrieveTagEvents(tags, clubName, days, channelID, callback) {
    let dateToLookFor = DateTime.now().plus({ days: days}).toISO();

    db.all(`SELECT * from events t1 WHERE NOT exists (SELECT 1 FROM messages t2 WHERE t1.eventId = t2.eventId AND $channelID = t2.channelID) AND end_time > strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') AND ($tag = '' OR EXISTS (SELECT * FROM json_each(eventCategory) WHERE value IN ($tag) COLLATE NOCASE)) AND ($cname = '' OR clubName=$cname COLLATE NOCASE) AND $days > end_time ORDER BY start_time`,
        {
            $tag:tags,
            $cname:clubName,
            $days:dateToLookFor,
            $channelID:channelID
        }, (err,rows) => {
        callback(rows);
    }) 
}


function insertUpdateMessage(msgID, chnID, eventID, data, expiryDate) {
    db.run(`INSERT INTO messages (messageID, channelID, eventId, oldData, expiryDate) VALUES (?, ?, ?, ?, ?);`,
        [msgID, chnID, eventID, data, expiryDate]
    )
}

function insertTracker(guildID, chnID, clubFilter, days, tagFilter) {
    db.run(`INSERT INTO trackers (guildID, channelID, clubFilter, daysPost, tagFilter) VALUES (?, ?, ?, ?, ?);`,
        [guildID, chnID, clubFilter, days, tagFilter]
    )
    setupTrackerIDs();
}

function updateTracker(query, data) {
    db.run(`UPDATE trackers SET ${query.join(", ")} WHERE id=$id`,data)
    setupTrackerIDs();
}

function getOldMessages(callback) {
    return db.all(`SELECT * FROM  messages WHERE expiryDate < strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc');`, (err, rows) => {
        callback(rows);
    });
}

function removeMessage(msgID) {
    db.run(`DELETE FROM messages WHERE messageID = ?`, msgID);
}

function deleteTracker(trackerID) {
    db.run(`DELETE FROM trackers WHERE id=?`, trackerID);
}

function getAllTrackers(callback) {
    return db.all(`SELECT * FROM trackers`, (err, rows) => {
        callback(rows);
    });
}

function getGuildTrackers(guild, callback) {
    return db.all(`SELECT * FROM trackers WHERE guildID = ?`, guild, (err, rows) => {
        callback(rows);
    });
}

function getEvent(id, callback) {
    return db.all(`SELECT * FROM events WHERE eventId = ?`, id, (err, rows) => {
        callback(rows);
    });
}

function getEventMessage(id, callback) {
    return db.all(`SELECT * FROM events WHERE eventId = ?`, id, (err, rows) => {
        callback(rows);
    });
}

// Setup all known trackers
setupTrackerIDs();
getUniqueClubs();

function setupTrackerIDs() {
    activeTrackerIDs = [];
    db.all('SELECT * FROM trackers', (err, rows) => {
        for(let i=0; i<rows.length; i++) {
            activeTrackerIDs.push({"id":`${rows[i]["id"]}`, desc:`ID: ${rows[i]["id"]} ┃┃ Channel: ${rows[i]["channelID"]}`, guildID:rows[i]["guildID"], channelID: rows[i]["channelID"]});
        }
    })
}

function getUniqueClubs() {
    clubsList = [];
    db.all('SELECT DISTINCT clubName FROM events', (err, rows) => {
        for(let i=0; i<rows.length; i++) {
            clubsList.push(rows[i]["clubName"])      
        }
    })
}



module.exports = { dbUpdate, runQuery, retrieveEvent, insertUpdateMessage, getOldMessages, removeMessage, getAllTrackers, retrieveTagEvents, insertTracker, getGuildTrackers, activeTrackerIDs, clubsList, updateTracker, getEvent, deleteTracker }

// TBI


