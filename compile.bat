@echo off
call .\node_modules\.bin\tsc -p .\src\tsconfig.json
move .\src\*.js .\bot\
pause
