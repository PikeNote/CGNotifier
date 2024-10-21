const {SlashCommandBuilder, EmbedBuilder, PermissionsBitField, PermissionFlagsBits} = require('discord.js');
const {getGuildTrackers} = require('../../../scraper/sqliteHelper')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('view_trackers')
		.setDescription('List all active trackers in the current server/guild')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
	async execute(interaction) {
        if(interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            let rows = await getGuildTrackers(interaction.guildId)
            let fields = [];
            for(let i=0; i<rows.length; i++) {
                fields.push({
                    name: `Name: ${rows[i]["trackerName"]}`,
                    value: `ID: ${rows[i]["id"]} ┃┃ Channel: <#${rows[i]["channelID"]}> ┃┃ Tag Filter: ${rows[i]["tagFilter"]} ┃┃ Club Filter: ${rows[i]["clubFilter"]} ┃┃ Days To Post: ${rows[i]["daysPost"]}`,
                    inline: false
                })
            }

            if(rows.length != 0) {
                let embed = new EmbedBuilder()
                .setTitle("Current Server Trackers")
                .setColor("#FFFF00")
                .setFooter({
                    text: "CG Helper | Made with Caffiene ☕ ",
                    iconURL: "https://images.squarespace-cdn.com/content/v1/515eba28e4b0ecbdd5ac1a2a/1584457021090-RSC1ZPF45R02BL6GTX2K/CG_Blue_Profile+Photo.png",
                })
                .setTimestamp()
                .addFields(fields);
                

                await interaction.reply({embeds:[embed], ephemeral: true});
                
            } else {
                await interaction.reply({content: "There are no active trackers in this server!", ephemeral: true});
            }
        } else {
            interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
        }
        
	},
};

