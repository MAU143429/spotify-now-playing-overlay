Set WshShell = CreateObject("WScript.Shell")

' Change this path to your project folder
projectPath = "C:\path\to\spotify-now-playing-overlay"

' Run the server silently
WshShell.Run "cmd /c cd /d """ & projectPath & """ && npm start", 0, False