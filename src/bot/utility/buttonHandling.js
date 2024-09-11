const { ButtonStyle, ButtonBuilder, ActionRowBuilder, GuildScheduledEventManager, GuildScheduledEventEntityType, PermissionsBitField } = require('discord.js');
const {getEventMessage, getUserNotifications, getEvent, addUserNotification, deleteUserNotification, getUserNotificationByMessage} = require('../../scraper/sqliteHelper');
const { DateTime } = require("luxon");
const axios = require('axios');

async function buttonClicked(interaction) {
    switch(interaction.customId) {
        case 'notifCreate':
            notifCreate(interaction);
            break;
        case 'notifDelete':
            notifDelete(interaction);
            break;
        case 'addEvent':
            addEvent(interaction);
            break;
    }
    interaction.deferUpdate();
}

async function notifDelete(interaction) {
    let userNotifs = await getUserNotificationByMessage(interaction.message.id);

    if(userNotifs.length != 0) {
        deleteUserNotification(interaction.message.id);
    }
    interaction.message.delete();
}

async function notifCreate(interaction) {
    let rows = await getEventMessage(interaction.message.id);



    if(rows.length != 0) {
        const eventId = rows[0]["eventId"];
        let event = await getEvent(eventId);
        
        if(event.length > 0) {
            event = event[0];
            let deleteBtn = new ButtonBuilder()
            .setCustomId('notifDelete')
            .setLabel('❌ Delete Notification')
            .setStyle(ButtonStyle.Primary);

            let notifications = await getUserNotifications(interaction.user.id, eventId);
            let notificationDate = DateTime.fromISO(event['start_time']).minus({minutes: 30});
            let notificationDateString = notificationDate.setZone("America/New_York").toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

            const row = new ActionRowBuilder().addComponents(deleteBtn);

            if(notifications.length == 0) {
                interaction.user.send({content: `Notification added for **${event['eventName']}** (${eventId}! \nThis notification is scheduled for ${notificationDateString}`, components: [row]}).then(msg => {
                    addUserNotification(interaction.user.id, eventId, msg.id, notificationDate.toISO());
                }).catch(e => {
                    
                }) ;
            }
        }
    } else {
        // How tf did we even geth ere
    }
}

async function addEvent(interaction) {
    
    if(interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.CreateEvents)) {

        let rows = await getEventMessage(interaction.message.id);

        if(rows.length != 0) {
            const eventId = rows[0]["eventId"];
            let event = await getEvent(eventId);
            
            if(event.length > 0) {
                postEvent(event[0], `Requested by ${user.username} (${user.id})`)
            }
        }
    }
}

async function postEvent(event, reason) {
    const event_manager = new GuildScheduledEventManager(interaction.guild);

    let image = null;
    
    if(event['eventPicture'].trim() != '') {
        await axios.get(event['eventPicture'], 
            {responseType: 'arraybuffer'
        })
        .then(response => image = Buffer.from(response.data, 'binary'));
    }

    await event_manager.create({
        name: event['eventName'],
        scheduledStartTime: DateTime.fromISO(event['start_time']).toJSDate(),
        scheduledEndTime: DateTime.fromISO(event['end_time']).toJSDate(),
        description: event['eventDesc'].slice(0, 1000),
        image: image,
        reason: reason,
        privacyLevel: 2,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: {
            location: event['eventLocation']
        }
    }).catch(e => {
        console.warn(e);
        console.log("Possible lack of permissions...");
    })
}

module.exports = {buttonClicked, postEvent}