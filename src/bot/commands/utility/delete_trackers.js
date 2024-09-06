const {SlashCommandBuilder, ChannelType} = require('discord.js');
const {activeTrackerIDs, clubsList, updateTracker, deleteTracker, getGuildTrackers} = require('../../../scraper/sqliteHelper')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('delete_tracker')
		.setDescription('Edit a selected tracker with optional fields!')
		.addIntegerOption(option =>
			option.setName("tracker_id")
			.setDescription("The event tracker ID for the event (check view trackers for a list)")
			.setRequired(true)
			.setAutocomplete(true)
		),
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		let choices;
		let filtered;
		switch(focusedOption.name) {
			case 'tracker_id':
                interaction.client.channels.fetch(choices[i]["channelID"]).then((channel) => {
                    choices = activeTrackerIDs;
                    for(let i=0; i<choices.length; i++) {
                        choices[i]["desc"] = choices[i]["desc"].replace(choices[i]["channelID"],channel.name)
                    }
                    filtered = choices.filter(choice => choice.id.startsWith(focusedOption.value) && choice.guildID == interaction.guildId).slice(0,24).map(choice => ({ name: choice.desc, value: choice.id }));
                });
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
			let id = interaction.options.getInteger("tracker_id");

            let choices = activeTrackerIDs.filter(choice => choice.id==id);
            if(choices[0]['guildID'] != interaction.guild.id) {
                interaction.reply({content: "You don't have permission to delete a tracker in another guild!", ephemeral: true})
            }

            interaction.reply({content: "Deleted your tracker!", ephemeral: true})

            deleteTracker(id);
		} else {
			interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
		}
	},
};

