const {GuildScheduledEventManager} = require('discord.js');
const {DateTime} = require('luxon');

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

module.exports = {postEvent}