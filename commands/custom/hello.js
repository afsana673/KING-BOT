'use strict';
// Template: create another .js in commands/custom/ following this shape.
module.exports = {
  name: 'hello',
  aliases: ['hi'],
  category: 'Custom',
  description: 'Greet the person who used the command',
  usage: '',
  role: 'everyone',
  async run(ctx) {
    await ctx.reply(`👋 Hello! I am ${ctx.config.botName}.`);
  }
};
