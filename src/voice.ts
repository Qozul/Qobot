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

import { Queue } from "queue-typescript"
import { StreamDispatcher, VoiceChannel, VoiceConnection } from "discord.js"
import * as CORE from "./core"
import * as UTIL from "util";
import YTDL = require("ytdl-core")

interface StreamData {
    name: string;
    loop: boolean;
    isPaused: boolean;
    dispatcher: StreamDispatcher;
}

export class VoiceModule {
    private volume: number;
    private musicQueue: Queue<StreamData>;
    private connection: VoiceConnection;
    private current: StreamData;

    public constructor(bot: CORE.Bot) {
        this.volume = 1;
        this.musicQueue = new Queue<StreamData>();
        this.connection = null;
        bot.AddCommand(this, this.CommandStop);
        bot.AddCommand(this, this.CommandLeave);
        bot.AddCommand(this, this.CommandPlay);
        bot.AddCommand(this, this.CommandSkip);
        bot.AddCommand(this, this.CommandPause);
        bot.AddCommand(this, this.CommandShowQueue);
        bot.AddCommand(this, this.CommandEmptyQueue);
        bot.AddCommand(this, this.CommandVolume);
        bot.AddDestructor(this, this.CommandLeave);
    }

    public async CommandStop(info: CORE.CommandInfo) : Promise<void> {
        if (this.current == null) return;
        this.current.dispatcher.destroy();
        this.current = null;
    }

    public async CommandLeave(info: CORE.CommandInfo) : Promise<void> {
        if (this.connection == null) return;
        await this.CommandStop(info);
        this.connection.disconnect();
        this.connection = null;
    }

    public async CommandPlay(info: CORE.CommandInfo) : Promise<void> {
        if (this.connection == null) {
            if (!info.msg.member.voice.channel) return;
            this.connection = await info.msg.member.voice.channel.join();
            this.connection.on("warn", (str: string) : void => CORE.LOG_WARN("%s", str));
            this.connection.on("error", (err: Error) : void => CORE.LOG_ERROR("%s", err.message)); 
        }

        if (this.current != null) {
            if (this.current.isPaused && info.args.length < 1) { 
                this.current.dispatcher.resume();
                this.current.isPaused = false;
            }
            else if (info.args.length >= 1) {
                this.musicQueue.enqueue({ 
                    name: info.args[0],
                    loop: info.args.length > 2 && info.args[1] === "-l", 
                    isPaused: false, 
                    dispatcher: null 
                });
                if (info != null) info.msg.channel.send(UTIL.format("Enqueued %s with loop = ", info.args[0], info.args.length > 2 && info.args[1] === "-l"));
            }
            return;
        }
        
        if (this.current == null) {
            if (this.musicQueue.length === 0) {
                this.current = { 
                    name: info.args.length < 1 ? "https://www.youtube.com/watch?v=rEq1Z0bjdwc" : info.args[0], 
                    loop: info.args.length > 2 && info.args[1] === "-l", 
                    isPaused: false, 
                    dispatcher: null 
                };
            }
            else {
                this.current = this.musicQueue.dequeue();
            }

            this.current.dispatcher = this.connection.play( YTDL(this.current.name, { quality: "highestaudio", filter: "audioonly" }), { volume: this.volume });
            if (info != null) info.msg.channel.send(UTIL.format("Now playing %s with loop = ", this.current.name, this.current.loop));

            this.current.dispatcher.on("debug", (inf: string) : void => CORE.LOG_INFO("%s", inf));
            this.current.dispatcher.on("error", (str: string) : void => CORE.LOG_ERROR("%s", str)); // TODO should be Error not string
            this.current.dispatcher.on("finish", () : void => {
                if (!this.current.loop) {
                    this.NextSong();
                }
                else {
                    this.current.isPaused = true;
                    this.CommandPlay({msg: null, client: null, args: []});
                }
            });
        }
    }

    public async CommandSkip(info: CORE.CommandInfo) : Promise<void> {
        if (this.connection == null) return;
        this.NextSong();
    }

    public async CommandPause(info: CORE.CommandInfo) : Promise<void> {
        if (this.connection == null || this.current == null) return;
        if (this.current.isPaused) {
            this.current.dispatcher.resume();
            this.current.isPaused = false;
        }
        else {
            this.current.dispatcher.pause(true);
            this.current.isPaused = true;
        }
    }

    public async CommandShowQueue(info: CORE.CommandInfo) : Promise<void> {
        if (this.current !== null) {
            info.msg.channel.send(UTIL.format("Currently playing %s", this.current.name));
        }
        if (this.musicQueue.length === 0) {
            info.msg.channel.send("The music queue is empty.");
        }
        else {
            const queueAsArr : Array<StreamData> = this.musicQueue.toArray();
            let msg: string = "Queue has " + queueAsArr.length + " items.";
            queueAsArr.forEach((element : StreamData) : void => {
                msg += "\n" + element.name;
            });
            info.msg.channel.send(msg);
        }
    }

    public async CommandEmptyQueue(info: CORE.CommandInfo) : Promise<void> {
        while (this.musicQueue.length > 0) {
            this.musicQueue.dequeue();
        }
        info.msg.channel.send("Emptied the music queue.");
    }

    public async CommandVolume(info: CORE.CommandInfo) : Promise<void> {
        if (this.connection == null) return;
        const vol: number = this.volume;
        this.volume = parseFloat(info.args[0]);
        if (this.current != null) this.current.dispatcher.setVolume(this.volume);
        info.msg.channel.send(UTIL.format("Changed volume from %f to %f.", vol, this.volume));
    }

    private NextSong = async () : Promise<void> => {
        await this.CommandStop(null);
        if (this.musicQueue.length >= 1) this.CommandPlay({msg: null, client: null, args: []});
    }
}
