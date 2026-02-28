' Этот скрипт запускает start.bat в скрытом окне
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "d:\PycharmProjects\techsupport-pro---equipment-management-system\start.bat" & Chr(34), 0
Set WshShell = Nothing
