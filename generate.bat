rmdir /s /q .\node_modules
mkdir .\node_modules
call npm install @types/node @types/ws typescript discord.js queue-typescript ffmpeg-static @discordjs/opus ytdl-core
pause
