const {SlashCommandBuilder} = require('discord.js');
const {getEventData} = require('../../../scraper/eventGrabber')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('force_update')
		.setDescription('Force updates all the events and grabs all information from the API'),
	async execute(interaction) {
        if(interaction.user.id != "141382611518881792") {
            await interaction.reply({content: "You don't have the permissions to force an update!", ephemeral: true});
        } else {
            await interaction.reply({content:'Forcing updates...', ephemeral: true});
            getEventData(true);
        }
		
	},
};
