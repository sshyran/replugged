const { API } = require('powercord/entities');
const { getModule, channels: { getChannelId }, messages: { sendMessage, receiveMessage } } = require('powercord/webpack');

const { createBotMessage } = getModule([ 'createBotMessage' ], false);


async function handleCommand (options, args) {
  const { executor } = options;

  try {
    const channel = getChannelId();
    if (!channel) {
      return;
    }

    const res = await executor(args);

    if (!res || !res.result) {
      return;
    }

    if (!res.send) {
      const options = { embeds: [] };

      if (typeof res.result === 'string') {
        options.content = res.result;
      } else {
        options.embeds.push(res.result);
      }

      const msg = createBotMessage({
        channelId: channel,
        content: options?.content
      });
      receiveMessage(channel, msg);
    } else {
      sendMessage(channel, {
        content: res.result,
        invalidEmojis: [],
        validNonShortcutEmojis: [],
        tts: false
      });
    }
  } catch (error) {
    const msg = createBotMessage({
      channelId: void 0,
      content: ':x: An error occurred while running this command. Check your console.'
    });
    receiveMessage(void 0, msg);
  }
}


/**
 * @typedef PowercordChatCommand
 * @property {String} command Command name
 * @property {String[]} aliases Command aliases
 * @property {String} description Command description
 * @property {String} usage Command usage
 * @property {Function} executor Command executor
 * @property {Function|undefined} autocomplete Autocompletion method
 * @property {Boolean|undefined} showTyping Whether typing status should be shown or not
 */

/**
 * Replugged chat commands API
 * @property {Object.<String, PowercordChatCommand>} commands Registered commands
 */
class CommandsAPI extends API {
  constructor () {
    super();

    this.commands = new Map();
  }

  get prefix () {
    return powercord.settings.get('prefix', '.');
  }

  get find () {
    const arr = Array.from(this.commands.values());
    return arr.find.bind(arr);
  }

  get filter () {
    const arr = Array.from(this.commands.values());
    return arr.filter.bind(arr);
  }

  get map () {
    const arr = Array.from(this.commands.values());
    return arr.map.bind(arr);
  }

  get sort () {
    const arr = Array.from(this.commands.values());
    return arr.sort.bind(arr);
  }

  values () {
    return this.commands.values();
  }

  get size () {
    return this.commands.size;
  }

  /**
   * Registers a command
   * @param {PowercordChatCommand} command Command to register
   */
  registerCommand (options) {
    const { command, ...cmd } = options;

    this.commands.set(command, {
      type: 0,
      inputType: 0,
      target: 1,
      id: command,
      name: command,
      displayName: command,
      displayDescription: options.description,
      applicationId: 'replugged',
      dmPermission: true,
      listed: true,
      __replugged: true,
      options: [
        {
          type: 3,
          required: false,
          description: `Usage: ${cmd.usage?.replace?.(/{c}/g, command) ?? command}`,
          name: 'args',
          displayName: 'args',
          displayDescription: `Usage: ${cmd.usage?.replace?.(/{c}/g, command) ?? command}`
        }
      ],
      ...cmd,
      execute: async (result) => {
        try {
          handleCommand(options, Object.values(result).map((e) => e.value) ?? []);
        } catch (error) {
          console.error(error);
        }
      }
    });
  }

  /**
   * Unregisters a command
   * @param {String} command Command name to unregister
   */
  unregisterCommand (command) {
    this.commands.delete(command);
  }
}

module.exports = CommandsAPI;
