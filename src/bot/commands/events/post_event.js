const {SlashCommandBuilder, ChannelType, PermissionsBitField, PermissionFlagsBits} = require('discord.js');
const {getEvent} = require('../../../scraper/sqliteHelper')
const {embedBuilder} = require('../../utility/eventSender')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('post_single_event')
		.setDescription('Post a singular event based on the event ID that will get updated.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
			option.setName("event_id")
			.setDescription("Event ID of the event you are trying to post")
			.setRequired(true)
		)
        .addChannelOption(option =>
			option.setName('channel')
				.setDescription("Channel to post the event")
				.addChannelTypes(ChannelType.GuildText)
		),
	async execute(interaction) {
        if(interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            let rows = await getEvent(interaction.options.getString('event_id'));
			if(rows.length > 0) {
				interaction.reply({content: 'Sending event...', ephemeral: true});
				let channel = interaction.options.getChannel("channel") ?? interaction.channel;

				channel.send(embedBuilder(rows[0]));
			} else {
				interaction.reply({content: "That event does not exist or it has been posted too recently. Please try again later.", ephemeral: true})
			}
        } else {
			interaction.reply({content: "You don't have permission to use this command!", ephemeral: true})
		}
        
	},
};

