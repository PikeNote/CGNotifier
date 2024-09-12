const {SlashCommandBuilder, ChannelType, EmbedBuilder, ButtonStyle, ButtonBuilder, ActionRowBuilder} = require('discord.js');
const {DateTime, Settings} = require('luxon');
const { removeMessage } = require('../../scraper/sqliteHelper');

function embedBuilder(queryResults) {
    let startString = DateTime.fromISO(queryResults["start_time"]).setZone("America/New_York").toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	let endString = DateTime.fromISO(queryResults["end_time"]).setZone("America/New_York").toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    let color = "#00b0f4"
    let liveStatus = false;
    let eventName = queryResults["eventName"];
    if(DateTime.fromISO(queryResults["start_time"]) < Date.now()) {
        eventName = "(🔴 LIVE) " + queryResults["eventName"];
        color = "#D2042D"
        liveStatus = true;
    }
    
    let embed = new EmbedBuilder()
    .setAuthor({
        name: queryResults["clubName"],
        url: queryResults["clubURL"],
    })
    .setTitle(eventName)
    .setURL(queryResults["eventUrl"])
    .setDescription(queryResults["eventDesc"])
    .addFields(
        {
            name: "Tags",
            value: JSON.parse(queryResults["eventCategory"]).join(", "),
            inline: false
        },
        {
            name: "Attendees",
            value: `${queryResults["eventAttendees"]}`,
            inline: true
        },
        {
            name: "Price",
            value: queryResults["eventPriceRange"] != '' ? queryResults["eventPriceRange"] : 'FREE',
            inline: true
        },
        {
            name: " ",
            value: " ",
            inline: false
        },
        {
            name: "Start Time",
            value: startString,
            inline: true
        },
        {
            name: "End Time",
            value: endString,
            inline: true
        },
        {
            name: "Location",
            value: queryResults["eventLocation"],
            inline: false
        },
        {
            name: "🗓️ Add to Calendar",
            value: `[Calendar Link](` + encodeURI(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${queryResults["eventName"]}&details=${queryResults["eventDesc"].substring(0,350).replace(/[!'()*]/g, function(c) {return '%' + c.charCodeAt(0).toString(16);}) + "..."}&dates=${DateTime.fromISO(queryResults["start_time"]).setZone("America/New_York").toISO({ format: 'basic'})}/${DateTime.fromISO(queryResults["end_time"]).setZone("America/New_York").toISO({ format: 'basic' })}&ctz=America/New_York&location=${queryResults["eventLocation"]}`) + ')'
        }
    )
    .setColor(color)
    .setFooter({
        text: "CG Helper | Last Updated ",
        iconURL: "https://images.squarespace-cdn.com/content/v1/515eba28e4b0ecbdd5ac1a2a/1584457021090-RSC1ZPF45R02BL6GTX2K/CG_Blue_Profile+Photo.png",
    })
    .setTimestamp();

    if(queryResults["eventPicture"]?.trim() != '') {
        embed.setImage(queryResults["eventPicture"])
    }

    let notification = new ButtonBuilder()
        .setCustomId('notifCreate')
        .setLabel('🔔Notify Me (30 minutes)')
        .setStyle(ButtonStyle.Primary);
    
    let eventAdd = new ButtonBuilder()
        .setCustomId('addEvent')
        .setLabel('📋 Add To Events')
        .setStyle(ButtonStyle.Success);

    if(liveStatus) {
        return { embeds: [embed], live:liveStatus}
    }

    const row = new ActionRowBuilder().addComponents(eventAdd, notification);
    return { embeds: [embed], components: [row] }
    
}

async function updateMessage(queryResults, channelID, messageID) {
    let newData = [];
    await global.client.channels.fetch(channelID).then(async (channel) => {
        await channel.messages.fetch(messageID).then(message => {
            let embed = embedBuilder(queryResults,true);
            let live = embed['live'];
            delete embed['live'];
            if(live && queryResults["liveStatus"] == 0) {
                message.delete();
                channel.send(embed).then(message => {
                    newData = [message.id, channel.id, queryResults["eventId"],JSON.stringify(queryResults),queryResults["end_time"], 1];
                })
            } else {
                message.edit(embed);
            }
        }).catch(err => {
            //console.error(err);
            removeMessage(messageID);
        });
    }).catch(e => {
        
    })
    return newData;
}

module.exports = {updateMessage, embedBuilder}