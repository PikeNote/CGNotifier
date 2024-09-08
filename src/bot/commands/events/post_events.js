const {SlashCommandBuilder, ChannelType, PermissionsBitField} = require('discord.js');
const {retrieveEvent, insertUpdateMessage} = require('../../../scraper/sqliteHelper');
const { DateTime, Settings } = require("luxon");
const {embedBuilder} = require("../../utility/eventSender");
const wait = (seconds) => 
    new Promise(resolve => 
       setTimeout(() => resolve(true), seconds * 1000)
    );

module.exports = {
	data: new SlashCommandBuilder()
		.setName('post_events')
		.setDescription('Channel')
		.addIntegerOption(option =>
			option.setName("events")
				.setDescription("Number of events to post and update")
				.setMinValue(1)
				.setMaxValue(50)
				.setRequired(true)
		)
		.addChannelOption(option => 
				option.setName("channel")
				.setDescription("Channel to post the events")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		)
		.addStringOption(option =>
            option.setName('club_name')
			.setDescription("Name of the club to only post events from")
		)
		.addStringOption(option =>
            option.setName('tags')
			.setDescription("Comma seperated list of all tags you'd like to only see posts from")
		),
		
	async execute(interaction) {
		if(interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
			const channelPost = interaction.options.getChannel("channel");
			let numberOfEvents = interaction.options.getInteger("events");
			let clubName = interaction.options.getString("club_name") ?? '';
			clubName = clubName.trim();
			const eventTag = interaction.options.getString("tags") ?? '';

			interaction.reply({content: "Sending events...", ephemeral: true})
			
			let queryResults = await retrieveEvent(eventTag, clubName)
			if(numberOfEvents>queryResults.length)
				numberOfEvents = queryResults.length;

			for(let i=0; i<numberOfEvents; i++) {
				channelPost.send(embedBuilder(queryResults[i]))
				.then(msg => {
					insertUpdateMessage(msg.id, msg.channelId, queryResults[i]["eventId"], JSON.stringify(queryResults[i]), queryResults[i]["end_time"]);
				})
				await wait(1);
			}
			
		} else {
			interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
		}
		
	},
};