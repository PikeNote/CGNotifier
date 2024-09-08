const { ButtonStyle, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const {getEventMessage, getUserNotifications, getEvent, addUserNotification, deleteUserNotification, getUserNotificationByMessage} = require('../../scraper/sqliteHelper');
const { DateTime } = require("luxon");

async function buttonClicked(interaction) {
    switch(interaction.customId) {
        case 'notifCreate':
            notifCreate(interaction);
            break;
        case 'notifDelete':
            notifDelete(interaction);
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
                });
            }
        }
    } else {
        // How tf did we even geth ere
    }
}

module.exports = {buttonClicked}