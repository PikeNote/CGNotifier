const {SlashCommandBuilder, ChannelType} = require('discord.js');
const {activeTrackerIDs, clubsList, updateTracker} = require('../../../scraper/sqliteHelper')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update_tracker')
		.setDescription('Edit a selected tracker with optional fields!')
		.addIntegerOption(option =>
			option.setName("tracker_id")
			.setDescription("The event tracker ID for the event (check view trackers for a list)")
			.setRequired(true)
			.setAutocomplete(true)
		)
		.addChannelOption(option =>
			option.setName('channel')
				.setDescription("New channel to post the events")
				.addChannelTypes(ChannelType.GuildText)
		)
		.addStringOption(option =>
            option.setName('club_name')
			.setDescription("New name of the club to only see posts from (Default: All)")
			.setAutocomplete(true)
		)
		.addStringOption(option =>
            option.setName('tags')
			.setDescription("New comma seperated list of all tags you'd like to only see posts from (Defaut: All)")
		)
		.addIntegerOption(option => 
			option.setName("number_of_days")
			.setDescription("New number of days out from an event when you would like to see it posted (Default: 10)")
			.setMaxValue(30)
			.setMinValue(1)
		),
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		let choices;
		let filtered;

		switch(focusedOption.name) {
			case 'tracker_id':
				choices = activeTrackerIDs;
				for(let i=0; i<choices.length; i++) {
					interaction.client.channels.fetch(choices[i]["channelID"]).then(channel => {
						choices[i]["desc"] = choices[i]["desc"].replace(choices[i]["channelID"],channel.name)
					});
				}
				filtered = choices.filter(choice => choice.id.startsWith(focusedOption.value) && choice.guildID == interaction.guildId).slice(0,24).map(choice => ({ name: choice.desc, value: choice.id }));
				break;
			case 'club_name':
				filtered = clubsList.filter(club => club.startsWith(focusedOption.value)).slice(0,24).map(choice => ({ name: choice, value: choice }));
				break;
		}

		await interaction.respond(
			filtered
		);

	},
	async execute(interaction) {
		if(interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
			let updatedFields = [];
			let data = { $id: interaction.options.getInteger("tracker_id")};
			const channelPost = interaction.options.getChannel("channel");
			const clubName = interaction.options.getString("club_name");
			const eventTag = interaction.options.getString("tags");
			const days = interaction.options.getInteger("number_of_days")

			let choices = activeTrackerIDs.filter(choice => choice.id==data.$id);

			if(choices[0]['guildID'] != interaction.guild.id) {
				interaction.reply({content: "You don't have permission to update trackers not in your server!", ephemeral: true});
				return;
			}

			if(channelPost) {
				updatedFields.push(`channelID=$channelID`)
				data.$channelID=channelPost.id;
			}

			if(clubName) {
				updatedFields.push(`clubFilter=$clubFilter`);
				data.$clubFilter=clubName.trim();
			}

			if(eventTag) {
				updatedFields.push(`tagFilter=$tagFilter`);
				data.$tagFilter=eventTag
			}

			if(days) {
				updatedFields.push(`daysPost=$daysPost`);
				data.$daysPost = days;
			}

			interaction.reply({content: "Updated your tracker!", ephemeral: true})

			updateTracker(updatedFields, data)
		} else {
			interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
		}
	},
};

