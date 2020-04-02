/*
Copyright 2020 Ralph Ridley

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { Client, Message, DiscordAPIError, TextChannel, GuildMember } from "discord.js"
import * as UTIL from "util";
import * as CONFIG from "../config.json";
import * as TOKEN from "../token.json";

/* Functions for debug logging to the console in a useful manner. Use is similar to clib printf. */
export function LOG_INFO(format: string, ...args: any[]) : void {
    console.log(UTIL.format("\x1b[37m[INFO %s] " + format, new Date().toLocaleTimeString('en-GB', { hour: "numeric", minute: "numeric"}), ...args));
}

export function LOG_WARN(format: string, ...args: any[]) : void {
    console.warn(UTIL.format("\x1b[33m[WARN %s] " + format, new Date().toLocaleTimeString('en-GB', { hour: "numeric", minute: "numeric"}), ...args));
}

export function LOG_ERROR(format: string, ...args: any[]) : void {
    console.error(UTIL.format("\x1b[31m[ERR %s] " + format, new Date().toLocaleTimeString('en-GB', { hour: "numeric", minute: "numeric"}), ...args));
}

/* CommandInfo is always passed to command functions. All command functions must have only one parameter, which is CommandInfo. */
export interface CommandInfo {
    msg: Message;
    client: Client;
    args: Array<string>; // Each argument validated as specified in the config (or "" if optional and not present);
}

interface CommandStruct {
    obj: object;
    func: Function;
}

/* 
    The main class defining the core implementation of a Bot using this framework. Works as an interface between the discord client
    and the bot program. Notably, deals with safe command parsing, including help and terminate commands built in.
*/
export class Bot {
    private readonly client: Client;
    private cmdMap: Map<string, CommandStruct>;
    private dtorMap: Array<CommandStruct>;
    private botId: string;

    public get BotId() : string {
        return this.botId;
    }
    public get Client() : Client {
        return this.client;
    }

    public constructor() {
        this.client = new Client;
        this.cmdMap = new Map<string, CommandStruct>();
        this.dtorMap = new Array<CommandStruct>();
        this.AddCommand(this, this.CommandHelp);
        this.AddCommand(this, this.CommandTerminate);
    }

    public Start = () : void => {
        LOG_INFO("Starting bot...");

        /* ready -> initialises client and server info when bot is connected to the client. */
        this.client.on("ready", () : void => {
            LOG_INFO("Connected to client.");
            this.botId = this.client.user.id;
        });

        /* error/warn -> logs to when bot is has an error or warning. */
        this.client.on("error", (err: Error) : void => LOG_ERROR("%s", err.message));
        this.client.on("warn", (str: string) : void => LOG_WARN("%s", str));
        
        /* message -> callback for when a message is sent in a channel visible to the bot. */
        this.client.on("message", (msg : Message) : void => {
            if (msg.author.id === this.botId) return;
            if (msg.content.length === 0 || msg.content[0] !== CONFIG.cmdprefix) return;
            this.ParseCommand(msg);
        });

        if (TOKEN.token.length == 0) {
            LOG_ERROR("Token not set up!");
            return;
        }
        /* Logs the bot in with the token supplied in the config. May fail if token is invalid. */
        this.client.login(TOKEN.token);
    }

    /* Add a destructur, can have as many as you want for any module, although one is recommended. Dtors MUST be async. */
    public AddDestructor = (obj: object, func: Function) : void => {
        this.dtorMap.push({ obj: obj, func: func });
    }

    /* 
        Add a command to the command list. The command must have meta info defined in the config file.
        Command functions MUST not be anonymous so to enable their name to be visible. 
    */
    public AddCommand = (obj: object, cmd: Function) : void => {
        if (this.FindIndexByFuncName(cmd.name) !== -1 && !this.cmdMap.has(cmd.name)) this.cmdMap.set(cmd.name, { obj: obj, func: cmd });
    }
    
    /* 
        Validate the input message and if successful calls the command's function. Returns true on success, false otherwise.
        Validation checks against the data info config.json, ensuring all required parameters exist and match a regex. The
        function included in the config data must have been added in a prior call to AddCommand. Additionally, the
        validation checks that the permissions of the messager allow them to use the command.
    */
    private ParseCommand = (msg: Message) : boolean => {
        const split = msg.content.split(" ");
        if (split.length < 1 || split[0].length < 1) return false;

        const idx = this.FindIndexByCmdName(split[0].substr(1).toLowerCase());
        if (idx === -1 || !this.cmdMap.has(CONFIG.commands[idx].func)) return false;

        // TODO: check author permission
        if (split.length < CONFIG.commands[idx].reqargc + 1) return false;

        let info: CommandInfo = { msg: null, client: null, args: [] };
        info.msg = msg;
        info.client = this.client;
        
        let i: number = 0;
        for (i = 0; i + 1 < split.length && i < CONFIG.commands[idx].argval.length; ++i) {
            const arg = CONFIG.commands[idx].argval[i].casesensitive ? split[i + 1] : split[i + 1].toLowerCase();
            if (!RegExp(CONFIG.commands[idx].argval[i].valid).test(arg)) {
                return false;
            }
            info.args[i] = arg;
        }
        
        let cmdInfo = this.cmdMap.get(CONFIG.commands[idx].func);
        cmdInfo.func.call(cmdInfo.obj, info);

        return true;
    }

    /* 
        FindIndexBy... returns the index of the command in the config commands list that matches the given name or func name.
        If the name cannot be found, returns -1.
    */
    private FindIndexByCmdName = (name: string) : number => {
        for (let i: number = 0; i < CONFIG.commands.length; ++i) {
            if (CONFIG.commands[i].name === name) return i;
        }
        return -1;
    }

    private FindIndexByFuncName = (func: string) : number => {
        for (let i: number = 0; i < CONFIG.commands.length; ++i) {
            if (CONFIG.commands[i].func === func) return i;
        }
        return -1;
    }

    /* Help reads all of the data in the config commands array and formats them to display in discord. */
    private async CommandHelp(info: CommandInfo) : Promise<void> {
        let msg: string = "```\n";
        CONFIG.commands.forEach((element: any) => {
            msg += element.name + "\n\t";
            msg += element.description + "\n\t";
        });
        msg += "```";
        info.msg.channel.send(msg);
    }

    /* Terminate turns the bot off and calls all module destructors. */
    private CommandTerminate(info: CommandInfo) : void {
        LOG_INFO("Terminating.");
        let promises: Array<Promise<void>> = [];
        for (let i: number = 0; i < this.dtorMap.length; ++i) {
            promises.push(this.dtorMap[i].func.call(this.dtorMap[i].obj, {}));
        }

        Promise.all(promises).then(() => {
            process.exit();
        });
    }
}
