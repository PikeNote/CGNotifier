const {SlashCommandBuilder} = require('discord.js');
const {updateInfo} = require('../../../scraper/eventGrabber')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('force_update')
		.setDescription('Force updates all the events and grabs all information from the API')
        .addBooleanOption(option =>
            option.setName('force')
                .setDescription('Whether or not to force update all messages and events')),
	async execute(interaction) {
        let force = interaction.options.getBoolean('force') ?? false;
        if(interaction.user.id != "141382611518881792") {
            await interaction.reply({content: "You don't have the permissions to force an update!", ephemeral: true});
        } else {
            await interaction.reply({content:'Forcing updates...', ephemeral: true});
            updateInfo(force);
        }
		
	},
};

