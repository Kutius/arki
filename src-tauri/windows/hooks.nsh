; Arki NSIS Installer Hooks
; Registers context menu entries via:
; 1. SystemFileAssociations (classic menu, works on Win10/Win11)
; 2. Sparse Package with IExplorerCommand (modern menu, Win11 only)

!macro ADD_CONTEXT_MENU ext
  ; Open with Arki
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-open" "" "Open with Arki"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-open" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --open "%1"'

  ; Extract here (解压到当前目录)
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-here" "" "Extract Here"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-here" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-here\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --extract-here "%1"'

  ; Extract to folder (解压到文件夹)
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-to-folder" "" "Extract to Folder"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-to-folder" "Icon" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-to-folder\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" --extract-to-folder "%1"'
!macroend

!macro REMOVE_CONTEXT_MENU ext
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-open"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-here"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\arki-extract-to-folder"
!macroend

!macro REGISTER_COM_SERVER
  ; Register COM server for IExplorerCommand (Win11 modern menu)
  ExecWait '"regsvr32.exe" /s "$INSTDIR\arki_shell_extension.dll"'
!macroend

!macro UNREGISTER_COM_SERVER
  ; Unregister COM server (ignore errors if DLL was already removed)
  IfFileExists "$INSTDIR\arki_shell_extension.dll" 0 +2
    ExecWait '"regsvr32.exe" /u /s "$INSTDIR\arki_shell_extension.dll"'
!macroend

!macro REGISTER_SPARSE_PACKAGE
  ; Register sparse package for Win11 modern context menu
  nsExec::ExecToStack 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "$INSTDIR\sparse-package\Register-SparsePackage.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  Pop $1
!macroend

!macro UNREGISTER_SPARSE_PACKAGE
  ; Unregister sparse package (ignore errors if script was already removed)
  IfFileExists "$INSTDIR\sparse-package\Register-SparsePackage.ps1" 0 +3
    nsExec::ExecToStack 'powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "$INSTDIR\sparse-package\Register-SparsePackage.ps1" -InstallDir "$INSTDIR" -Unregister'
    Pop $0
    Pop $1
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; Embed COM DLL for Win11 modern context menu
  ; Note: Paths must be absolute or relative to where NSIS compiler runs (project root)
  File /nonfatal /oname=$INSTDIR\arki_shell_extension.dll "src-tauri\target\release\arki_shell_extension.dll"

  ; Embed sparse package files for Win11 modern context menu
  CreateDirectory "$INSTDIR\sparse-package"
  CreateDirectory "$INSTDIR\sparse-package\Assets"
  SetOutPath "$INSTDIR\sparse-package"
  File /nonfatal "src-tauri\windows\sparse-package\AppxManifest.xml"
  File /nonfatal "src-tauri\windows\sparse-package\Register-SparsePackage.ps1"
  SetOutPath "$INSTDIR\sparse-package\Assets"
  File /nonfatal "src-tauri\windows\sparse-package\Assets\StoreLogo.png"
  File /nonfatal "src-tauri\windows\sparse-package\Assets\Square150x150Logo.png"
  File /nonfatal "src-tauri\windows\sparse-package\Assets\Square44x44Logo.png"
  SetOutPath $INSTDIR
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; ProgID for OpenWith and icon
  WriteRegStr HKCU "Software\Classes\Arki.Archive" "" "Arki Archive"
  WriteRegStr HKCU "Software\Classes\Arki.Archive\DefaultIcon" "" "$INSTDIR\${MAINBINARYNAME}.exe,0"

  ; Register in "Open with" list for supported extensions
  WriteRegStr HKCU "Software\Classes\.zip\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.7z\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.rar\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.tar\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.gz\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.tgz\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.br\OpenWithProgids" "Arki.Archive" ""
  WriteRegStr HKCU "Software\Classes\.zst\OpenWithProgids" "Arki.Archive" ""

  ; Context menu entries via SystemFileAssociations (classic menu)
  !insertmacro ADD_CONTEXT_MENU ".zip"
  !insertmacro ADD_CONTEXT_MENU ".7z"
  !insertmacro ADD_CONTEXT_MENU ".rar"
  !insertmacro ADD_CONTEXT_MENU ".tar"
  !insertmacro ADD_CONTEXT_MENU ".gz"
  !insertmacro ADD_CONTEXT_MENU ".tgz"
  !insertmacro ADD_CONTEXT_MENU ".br"
  !insertmacro ADD_CONTEXT_MENU ".zst"

  ; Register COM server for Win11 modern context menu
  !insertmacro REGISTER_COM_SERVER

  ; Register sparse package for Win11 modern context menu
  !insertmacro REGISTER_SPARSE_PACKAGE

  ; Refresh shell
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Unregister sparse package first
  !insertmacro UNREGISTER_SPARSE_PACKAGE

  ; Unregister COM server
  !insertmacro UNREGISTER_COM_SERVER

  ; Remove embedded files
  Delete "$INSTDIR\arki_shell_extension.dll"
  RMDir /r "$INSTDIR\sparse-package"

  ; Remove ProgID
  DeleteRegKey HKCU "Software\Classes\Arki.Archive"

  ; Remove from OpenWith list
  DeleteRegValue HKCU "Software\Classes\.zip\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.7z\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.rar\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.tar\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.gz\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.tgz\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.br\OpenWithProgids" "Arki.Archive"
  DeleteRegValue HKCU "Software\Classes\.zst\OpenWithProgids" "Arki.Archive"

  ; Remove context menu entries
  !insertmacro REMOVE_CONTEXT_MENU ".zip"
  !insertmacro REMOVE_CONTEXT_MENU ".7z"
  !insertmacro REMOVE_CONTEXT_MENU ".rar"
  !insertmacro REMOVE_CONTEXT_MENU ".tar"
  !insertmacro REMOVE_CONTEXT_MENU ".gz"
  !insertmacro REMOVE_CONTEXT_MENU ".tgz"
  !insertmacro REMOVE_CONTEXT_MENU ".br"
  !insertmacro REMOVE_CONTEXT_MENU ".zst"

  ; Refresh shell
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend
