const {SlashCommandBuilder,ChannelType, PermissionsBitField, PermissionFlagsBits} = require('discord.js');
const {insertTracker, getClubList} = require('../../../scraper/sqliteHelper');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('create_tracker')
		.setDescription('Post new future events and live update events based on tags and club names within a time period')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addStringOption(option => 
			option.setName('tracker_name')
				.setDescription("Name of the tracker to help distinguish it when you need to modify it! (Max Length: 20)")
				.setRequired(true)
				.setMaxLength(20)
		)
		.addChannelOption(option =>
			option.setName('channel')
				.setDescription("Channel to post the events")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
		)
		.addStringOption(option =>
            option.setName('club_name')
			.setDescription("Name of the club to only see posts from (Default: All)")
			.setAutocomplete(true)
		)
		.addStringOption(option =>
            option.setName('tags')
			.setDescription("Comma seperated list of all tags you'd like to only see posts from (Defaut: All)")
		)
		.addIntegerOption(option => 
			option.setName("number_of_days")
			.setDescription("The number of days out from an event when you would like to see it posted (Default: 10)")
			.setMaxValue(30)
			.setMinValue(1)
		)
		.addBooleanOption(option =>
            option.setName('post_event')
            .setDescription('Whether you want the bot to automaticlly post to Discord events (Default: False)')
		)
		.addStringOption(option =>
            option.setName('custom_club_name')
			.setDescription("Comma seperated list of all clubs you'd like to only see posts from;")
		),
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		let filtered;

		switch(focusedOption.name) {
			case 'club_name':
				filtered = getClubList().filter(
					club => club.toLowerCase().startsWith(focusedOption.value.trim().toLowerCase())
				).slice(0,24).map(choice => 
					({ name: choice, value: choice }) 
				);
				break;
		}

		await interaction.respond(
			filtered
		);

	},
	async execute(interaction) {
		if(interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
			const channelPost = interaction.options.getChannel("channel");
			const trackerName = interaction.options.getString("tracker_name");
			let clubName = interaction.options.getString("club_name") ?? '';
			clubName = clubName.trim();
			let clubCustomName = interaction.options.getString("custom_club_name") ?? clubName;
			const eventTag = interaction.options.getString("tags") ?? '';
			const days = interaction.options.getInteger("number_of_days") ?? 10
			const postEvent = interaction.options.getBoolean('post_event') ?? false;
			

			interaction.reply({content: "Adding new tracker... (events will be posted next update)", ephemeral: true})

			insertTracker(trackerName, interaction.guild.id, channelPost.id, clubCustomName, days, eventTag, postEvent ? 1 : 0);
		} else {
			interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
		}
	},
};