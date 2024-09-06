const {SlashCommandBuilder, ChannelType, EmbedBuilder, ButtonStyle, ButtonBuilder, ActionRowBuilder} = require('discord.js');
const {DateTime} = require('luxon');

function embedBuilder(queryResults) {
    let startString = DateTime.fromISO(queryResults["start_time"]).toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
	let endString = DateTime.fromISO(queryResults["end_time"]).toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    let color = "#00b0f4"
    if(DateTime.fromISO(queryResults["start_time"]) < Date.now()) {
        queryResults["eventName"] = "(🔴 LIVE) " + queryResults["eventName"];
        color = "#D2042D"
    }
    
    let embed = new EmbedBuilder()
    .setAuthor({
        name: queryResults["clubName"],
        url: queryResults["clubURL"],
    })
    .setTitle(queryResults["eventName"])
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
            value: queryResults["eventPriceRange"],
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

    let button = new ButtonBuilder()
        .setLabel('Add to Calendar 🗓️')
        .setURL(encodeURI(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${queryResults["eventName"]}&details=${queryResults["eventDesc"].substring(0,100) + "..."}&dates=${DateTime.fromISO(queryResults["start_time"]).toISO({ format: 'basic'})}/${DateTime.fromISO(queryResults["end_time"]).toISO({ format: 'basic' })}&ctz=America/New_York&location=${queryResults["eventLocation"]}`))
        .setStyle(ButtonStyle.Link);

    let notification = new ButtonBuilder()
        .setCustomId('notif')
        .setLabel('🔔Notify Me (30 minutes)')
        .setStyle(ButtonStyle.Primary);
        
    const row = new ActionRowBuilder().addComponents(button, notification);

    return { embeds: [embed], components: [row]}

}

function updateMessage(queryResults, channelID, messageID) {
    const channel = this.client.channels.fetch(channelID).then((channel) => {
        channel.messages.fetch(messageID).then(message => {
            message.edit(embedBuilder(queryResults));
        }).catch(err => {
            console.error(err);
        });
    }).catch(e => {
        
    })
}

module.exports = {updateMessage, embedBuilder}