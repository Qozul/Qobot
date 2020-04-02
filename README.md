# Qobot
Sometimes it's fun to have a coding holiday and play around with a new language. Qobot is a typescript Discord bot which executes in the NodeJS runtime and is built to be modular, essentially passing commands through to the appropriate module.

# Using the Bot
For convenience, there are three windows batch files included which set everything up for you. Firstly, make sure [NodeJS](https://nodejs.org/en/) is installed or up to date. Then, clone the repo and run the generate.bat to install the node_modules (all locally). Next, run the compile.bat any time you want to compile the source code to JavaScript, this will need to be run after cloning. Finally, to activate the bot use run.bat.

# Token
Discord bots require a token. This repo provides a solid foundation for the code of the bot, but you will need to have a bot set up on the Discord API (there are plenty of tutorials for this). To allow the bot to connect, you will have a private key which should be placed in the token.json file.

# Creating a Module
Have a look at the voice.ts module for a direct example. There are a couple of steps to adding a new module to the code.

The recommended method is to create your module in it's own typescript file as an `export class` with a constructor taking the bot as a parameter `public constructor(bot: CORE.Bot)`. This constructor should then call `bot.AddCommand` for every command it wants to register with the core bot. In addition, it should call AddDestructor to add a function that is called before the bot terminates the the core `!terminate` command.

The module should then be imported in to `index.ts` and then the constructor should be called before bot.start(), for example with the voice module `const voice: VoiceModule = new VoiceModule(bot);`. Now, the constructor will be called and all of the commands will be added. But there is one more step. The bot needs to have meta information about the commands for it to accept the functions and be able to validate them before passing them through.

In the file `config.json` there are several configuration options available. The one that matters for adding new commands for a module is the `commands` array. It holds values like this:
```
{
    "name": "terminate",
    "func": "CommandTerminate",
    "reqargc": 0,
    "argval": [],
    "permissions": ["owner"],
    "description": "Terminates the bot."
}
```
- `name` is what will follow the command prefix (`!` by default). 
- `func` is the name of the function that needs to be called in the code, it is recommended that these always begin with `Command` to helkp distinguish them. 
- `reqargc` is the count of arguments that are required to exist for the command call to be valid, for example a function may have two required arguments and 2 optional arguments (optional MUST always follow the required in the argument list), the core command handling will not pass on the command call if those required arguments don't exist.
- `argval` is an array containing info about an argument in the form of a bool and a regex `{ "casesensitive": true, "valid": "^(https:\/\/www.youtube.com\/)(watch|playlist)" }`. All arguments info is passed through to a module in lower case strings, unless `casesensitive` is specified as true in which case the argument retains its original casing. The regex is tested against the argument to ensure it is valid. If an argument exists that is not valid then the command will not pass through to the module.
- `permissions` Currently, this does not do anything. In the future, it will be used to test the user that sent to the command against groups and permissions tags, the user must fit in one or more of the groups specified to be able to use the command.
- `description` is simply what is displayed when the help command is used. It is also useful in the config file itself as a built in comment of what the function is for.

# Core Commands
The core bot module has two commands: `help` and `terminate`. Help displays information around the commands and terminate causes the bot process to exit. Terminate has been written under the assumption that the person running the bot is the only one with access. This should be set in its permissions to be your account name if you don't want anyone else using it. Both of these can be optionally removed by just removing them from the config (and then they won't get added).
