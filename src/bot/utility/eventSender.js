const {SlashCommandBuilder, RESTJSONErrorCodes , EmbedBuilder, ButtonStyle, ButtonBuilder, ActionRowBuilder} = require('discord.js');
const {DateTime, Settings} = require('luxon');
const { removeMessage } = require('../../scraper/sqliteHelper');

function embedBuilder(queryResults) {
    let startTimeISO = DateTime.fromISO(queryResults["start_time"]).setZone("America/New_York");
    let endTimeISO = DateTime.fromISO(queryResults["end_time"]).setZone("America/New_York");

    let startString = startTimeISO.toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	let endString = endTimeISO.toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    let color = "#00b0f4"
    let liveStatus = false;
    let eventName = queryResults["eventName"];
    if(DateTime.fromISO(queryResults["start_time"]) < Date.now()) {
        eventName = "(🔴 LIVE) " + queryResults["eventName"];
        color = "#D2042D"
        liveStatus = true;
    }

    let author = {
        name: queryResults["clubName"],
        url: queryResults["clubURL"],
    }

    if(queryResults["clubURL"] == '') {
        author = {name: queryResults["clubName"]}
    }

    let eventTags = JSON.parse(queryResults["eventCategory"]).join(", ");
    if(eventTags == '') {
        eventTags = ' ';
    }
    
    let embed = new EmbedBuilder()
    .setAuthor(author)
    .setTitle(eventName)
    .setURL(queryResults["eventUrl"])
    .setDescription(queryResults["eventDesc"])
    .addFields(
        {
            name: "Tags",
            value: eventTags,
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
            value: `[Calendar Link](` + encodeURI(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${queryResults["eventName"]}&details=${queryResults["eventDesc"].substring(0,300).replace(/[!'()*]/g, function(c) {return '%' + c.charCodeAt(0).toString(16);}) + "..."}&dates=${startTimeISO.toISO({ format: 'basic'})}/${endTimeISO.toISO({ format: 'basic' })}&location=${queryResults["eventLocation"]}`) + ')'
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
    try {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        let channel = await global.client.channels.fetch(channelID)
        let message = await channel.messages.fetch(messageID);

        let embed = await embedBuilder(queryResults,true);
        let live = embed['live'];
        delete embed['live'];
        if(live && queryResults["liveStatus"] == 0) {
            message.delete();
            let sentMsg = await channel.send(embed).catch( (e) => { console.warn(e);  return []; })
            return [sentMsg.id, channel.id, queryResults["eventId"],JSON.stringify(queryResults),queryResults["end_time"], 1];
        } else {
            message.edit(embed);
            return [];
        }
    } catch (err) {
        if(err.code == '10008' || err.code == '10003') {
            removeMessage(messageID);
        } else {
            console.warn(err);
        }
        return [];
    }
}

module.exports = {updateMessage, embedBuilder}