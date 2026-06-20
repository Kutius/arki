/*
 * Arki Shell Extension — IExplorerCommand implementation for Win11 modern context menu.
 *
 * Three verbs: Open with Arki, Extract Here, Extract to Folder.
 * Each verb is a separate COM class registered under the CLSIDs declared in AppxManifest.xml.
 * The DLL is loaded by dllhost.exe (surrogate); Invoke() simply launches arki.exe.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <stdlib.h>
#include <strsafe.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "kernel32.lib")

/* ── CLSIDs (must match AppxManifest.xml) ─────────────────────────────── */

// {D3F4A5B6-C7E8-4F9A-BC0D-3E4F5A6B7C8D}
static const CLSID CLSID_ArkiOpen =
    { 0xD3F4A5B6, 0xC7E8, 0x4F9A, { 0xBC, 0x0D, 0x3E, 0x4F, 0x5A, 0x6B, 0x7C, 0x8D } };

// {B1F2A3C4-D5E6-4F78-9A0B-1C2D3E4F5A6B}
static const CLSID CLSID_ArkiExtractHere =
    { 0xB1F2A3C4, 0xD5E6, 0x4F78, { 0x9A, 0x0B, 0x1C, 0x2D, 0x3E, 0x4F, 0x5A, 0x6B } };

// {C2F3A4B5-D6E7-4F89-AB0C-2D3E4F5A6B7C}
static const CLSID CLSID_ArkiExtractToFolder =
    { 0xC2F3A4B5, 0xD6E7, 0x4F89, { 0xAB, 0x0C, 0x2D, 0x3E, 0x4F, 0x5A, 0x6B, 0x7C } };

// {6D2B7E8F-9A1C-4D3E-B5F6-7A8B9C0D1E2F} — AppId for SurrogateServer (matches AppxManifest.xml)
static const GUID APPID_Arki =
    { 0x6D2B7E8F, 0x9A1C, 0x4D3E, { 0xB5, 0xF6, 0x7A, 0x8B, 0x9C, 0x0D, 0x1E, 0x2F } };

/* ── Helpers ──────────────────────────────────────────────────────────── */

static HINSTANCE g_hInst   = NULL;
static LONG      g_lockCount = 0;

static void DllLock(void)   { InterlockedIncrement(&g_lockCount); }
static void DllUnlock(void) { InterlockedDecrement(&g_lockCount); }

/*
 * Resolve the path to arki.exe.
 * Convention: arki.exe lives next to the DLL (same install dir).
 * The DLL sits at <installDir>\arki_shell_extension.dll,
 * so arki.exe is at <installDir>\arki.exe.
 */
static BOOL GetArkiExePath(LPWSTR buf, DWORD cch)
{
    if (!GetModuleFileNameW(g_hInst, buf, cch))
        return FALSE;

    // Strip filename, append arki.exe
    LPWSTR slash = wcsrchr(buf, L'\\');
    if (!slash) return FALSE;
    slash[1] = L'\0';

    return SUCCEEDED(StringCchCatW(buf, cch, L"arki.exe"));
}

/*
 * Launch arki.exe with the given verb flag and a file path.
 */
static HRESULT LaunchArki(LPCWSTR verb, IShellItemArray *psiItemArray)
{
    if (!psiItemArray)
        return E_INVALIDARG;

    DWORD count = 0;
    HRESULT hr = psiItemArray->lpVtbl->GetCount(psiItemArray, &count);
    if (FAILED(hr) || count == 0)
        return SUCCEEDED(hr) ? E_INVALIDARG : hr;

    WCHAR exePath[MAX_PATH];
    if (!GetArkiExePath(exePath, MAX_PATH))
        return E_FAIL;

    for (DWORD i = 0; i < count; i++)
    {
        IShellItem *pItem = NULL;
        hr = psiItemArray->lpVtbl->GetItemAt(psiItemArray, i, &pItem);
        if (FAILED(hr))
            continue;

        LPWSTR filePath = NULL;
        hr = pItem->lpVtbl->GetDisplayName(pItem, SIGDN_FILESYSPATH, &filePath);
        pItem->lpVtbl->Release(pItem);
        if (FAILED(hr) || !filePath)
            continue;

        // Build parameters: --verb "filepath"
        WCHAR params[MAX_PATH * 2];
        hr = StringCchPrintfW(params, ARRAYSIZE(params), L"%s \"%s\"", verb, filePath);
        CoTaskMemFree(filePath);

        if (SUCCEEDED(hr))
        {
            SHELLEXECUTEINFOW sei = { sizeof(sei) };
            sei.fMask  = SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI;
            sei.lpVerb = L"open";
            sei.lpFile = exePath;
            sei.lpParameters = params;
            sei.nShow  = SW_SHOWNORMAL;
            ShellExecuteExW(&sei);
        }
    }

    return S_OK;
}

/* ── IExplorerCommand implementation ──────────────────────────────────── */

typedef struct
{
    IExplorerCommandVtbl *lpVtbl;
    LONG                  refCount;
    LPCWSTR               verb;       // L"--open", L"--extract-here", L"--extract-to-folder"
    LPCWSTR               title;      // Display name for the menu item
} ArkiCommand;

// Forward declare vtable
static const IExplorerCommandVtbl ArkiCommand_Vtbl;

static ArkiCommand* ArkiCommand_Create(LPCWSTR verb, LPCWSTR title)
{
    ArkiCommand *p = (ArkiCommand *)CoTaskMemAlloc(sizeof(ArkiCommand));
    if (!p) return NULL;

    p->lpVtbl   = (IExplorerCommandVtbl *)&ArkiCommand_Vtbl;
    p->refCount = 1;
    p->verb     = verb;
    p->title    = title;
    return p;
}

// IUnknown
static HRESULT STDMETHODCALLTYPE ArkiCommand_QueryInterface(
    IExplorerCommand *This, REFIID riid, void **ppv)
{
    ArkiCommand *self = (ArkiCommand *)This;
    if (!ppv) return E_POINTER;

    if (IsEqualIID(riid, &IID_IUnknown) || IsEqualIID(riid, &IID_IExplorerCommand))
    {
        *ppv = self;
        self->refCount++;
        return S_OK;
    }

    *ppv = NULL;
    return E_NOINTERFACE;
}

static ULONG STDMETHODCALLTYPE ArkiCommand_AddRef(IExplorerCommand *This)
{
    ArkiCommand *self = (ArkiCommand *)This;
    return InterlockedIncrement(&self->refCount);
}

static ULONG STDMETHODCALLTYPE ArkiCommand_Release(IExplorerCommand *This)
{
    ArkiCommand *self = (ArkiCommand *)This;
    ULONG ref = InterlockedDecrement(&self->refCount);
    if (ref == 0)
        CoTaskMemFree(self);
    return ref;
}

// IExplorerCommand methods
static HRESULT STDMETHODCALLTYPE ArkiCommand_GetTitle(
    IExplorerCommand *This, IShellItemArray *psiItemArray, LPWSTR *ppszName)
{
    ArkiCommand *self = (ArkiCommand *)This;
    return SHStrDupW(self->title, ppszName);
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_GetIcon(
    IExplorerCommand *This, IShellItemArray *psiItemArray, LPWSTR *ppszIcon)
{
    // Use arki.exe's icon
    WCHAR exePath[MAX_PATH];
    if (GetArkiExePath(exePath, MAX_PATH))
        return SHStrDupW(exePath, ppszIcon);
    *ppszIcon = NULL;
    return E_NOTIMPL;
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_GetToolTip(
    IExplorerCommand *This, IShellItemArray *psiItemArray, LPWSTR *ppszInfotip)
{
    *ppszInfotip = NULL;
    return E_NOTIMPL;
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_GetCanonicalName(
    IExplorerCommand *This, GUID *pguidCommandName)
{
    *pguidCommandName = GUID_NULL;
    return S_OK;
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_GetState(
    IExplorerCommand *This, IShellItemArray *psiItemArray, BOOL fOkToBeSlow,
    EXPCMDSTATE *pCmdState)
{
    *pCmdState = ECS_ENABLED;
    return S_OK;
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_Invoke(
    IExplorerCommand *This, IShellItemArray *psiItemArray,
    IBindCtx *pbc)
{
    ArkiCommand *self = (ArkiCommand *)This;
    return LaunchArki(self->verb, psiItemArray);
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_GetFlags(
    IExplorerCommand *This, EXPCMDFLAGS *pFlags)
{
    *pFlags = ECF_DEFAULT;
    return S_OK;
}

static HRESULT STDMETHODCALLTYPE ArkiCommand_EnumSubCommands(
    IExplorerCommand *This, IEnumExplorerCommand **ppEnum)
{
    *ppEnum = NULL;
    return E_NOTIMPL;
}

static const IExplorerCommandVtbl ArkiCommand_Vtbl = {
    ArkiCommand_QueryInterface,
    ArkiCommand_AddRef,
    ArkiCommand_Release,
    ArkiCommand_GetTitle,
    ArkiCommand_GetIcon,
    ArkiCommand_GetToolTip,
    ArkiCommand_GetCanonicalName,
    ArkiCommand_GetState,
    ArkiCommand_Invoke,
    ArkiCommand_GetFlags,
    ArkiCommand_EnumSubCommands,
};

/* ── IClassFactory implementation ─────────────────────────────────────── */

typedef struct
{
    IClassFactoryVtbl *lpVtbl;
    LONG               refCount;
    LPCWSTR            verb;
    LPCWSTR            title;
} ArkiClassFactory;

static HRESULT STDMETHODCALLTYPE ArkiCF_QueryInterface(
    IClassFactory *This, REFIID riid, void **ppv)
{
    if (!ppv) return E_POINTER;
    if (IsEqualIID(riid, &IID_IUnknown) || IsEqualIID(riid, &IID_IClassFactory))
    {
        *ppv = This;
        return S_OK;
    }
    *ppv = NULL;
    return E_NOINTERFACE;
}

static ULONG STDMETHODCALLTYPE ArkiCF_AddRef(IClassFactory *This)
{
    ArkiClassFactory *self = (ArkiClassFactory *)This;
    return InterlockedIncrement(&self->refCount);
}

static ULONG STDMETHODCALLTYPE ArkiCF_Release(IClassFactory *This)
{
    ArkiClassFactory *self = (ArkiClassFactory *)This;
    ULONG ref = InterlockedDecrement(&self->refCount);
    if (ref == 0)
        CoTaskMemFree(self);
    return ref;
}

static HRESULT STDMETHODCALLTYPE ArkiCF_CreateInstance(
    IClassFactory *This, IUnknown *pUnkOuter, REFIID riid, void **ppv)
{
    ArkiClassFactory *self = (ArkiClassFactory *)This;
    if (pUnkOuter) return CLASS_E_NOAGGREGATION;

    ArkiCommand *cmd = ArkiCommand_Create(self->verb, self->title);
    if (!cmd) return E_OUTOFMEMORY;

    HRESULT hr = cmd->lpVtbl->QueryInterface(
        (IExplorerCommand *)cmd, riid, ppv);
    cmd->lpVtbl->Release((IExplorerCommand *)cmd);
    return hr;
}

static HRESULT STDMETHODCALLTYPE ArkiCF_LockServer(IClassFactory *This, BOOL fLock)
{
    if (fLock) DllLock(); else DllUnlock();
    return S_OK;
}

static const IClassFactoryVtbl ArkiClassFactory_Vtbl = {
    ArkiCF_QueryInterface,
    ArkiCF_AddRef,
    ArkiCF_Release,
    ArkiCF_CreateInstance,
    ArkiCF_LockServer,
};

static ArkiClassFactory* ArkiClassFactory_Create(LPCWSTR verb, LPCWSTR title)
{
    ArkiClassFactory *p = (ArkiClassFactory *)CoTaskMemAlloc(sizeof(ArkiClassFactory));
    if (!p) return NULL;

    p->lpVtbl   = (IClassFactoryVtbl *)&ArkiClassFactory_Vtbl;
    p->refCount = 1;
    p->verb     = verb;
    p->title    = title;
    return p;
}

/* ── CLSID → factory mapping ──────────────────────────────────────────── */

typedef struct { REFCLSID clsid; LPCWSTR verb; LPCWSTR title; } ClassEntry;

static const ClassEntry g_classes[] = {
    { &CLSID_ArkiOpen,           L"--open",            L"Open with Arki"     },
    { &CLSID_ArkiExtractHere,    L"--extract-here",    L"Extract Here"       },
    { &CLSID_ArkiExtractToFolder,L"--extract-to-folder",L"Extract to Folder" },
};

/* ── DLL Exports ──────────────────────────────────────────────────────── */

STDAPI DllGetClassObject(REFCLSID rclsid, REFIID riid, LPVOID *ppv)
{
    if (!ppv) return E_POINTER;
    *ppv = NULL;

    for (int i = 0; i < ARRAYSIZE(g_classes); i++)
    {
        if (IsEqualCLSID(rclsid, g_classes[i].clsid))
        {
            ArkiClassFactory *cf = ArkiClassFactory_Create(
                g_classes[i].verb, g_classes[i].title);
            if (!cf) return E_OUTOFMEMORY;

            HRESULT hr = cf->lpVtbl->QueryInterface(
                (IClassFactory *)cf, riid, ppv);
            cf->lpVtbl->Release((IClassFactory *)cf);
            return hr;
        }
    }

    return CLASS_E_CLASSNOTAVAILABLE;
}

STDAPI DllCanUnloadNow(void)
{
    return (g_lockCount == 0) ? S_OK : S_FALSE;
}

/* ── Self-registration (regsvr32) ─────────────────────────────────────── */

static const WCHAR CLSID_PREFIX[] = L"CLSID\\";

static HRESULT RegisterCLSID(REFCLSID clsid, LPCWSTR displayName)
{
    LPOLESTR clsidStr = NULL;
    HRESULT hr = StringFromCLSID(clsid, &clsidStr);
    if (FAILED(hr)) return hr;

    LPOLESTR appIdStr = NULL;
    hr = StringFromCLSID(&APPID_Arki, &appIdStr);
    if (FAILED(hr)) { CoTaskMemFree(clsidStr); return hr; }

    // Build key path: CLSID\{xxxxxxxx-...}
    WCHAR keyPath[256];
    hr = StringCchPrintfW(keyPath, ARRAYSIZE(keyPath), L"%s%s", CLSID_PREFIX, clsidStr);
    if (FAILED(hr)) { CoTaskMemFree(clsidStr); CoTaskMemFree(appIdStr); return hr; }

    // Create CLSID\{...} = displayName
    HKEY hKey = NULL;
    LRESULT lr = RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL,
                                  REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    if (lr != ERROR_SUCCESS) { CoTaskMemFree(clsidStr); CoTaskMemFree(appIdStr); return E_FAIL; }

    RegSetValueExW(hKey, NULL, 0, REG_SZ,
                   (const BYTE *)displayName,
                   (DWORD)((wcslen(displayName) + 1) * sizeof(WCHAR)));

    // Set AppId value so dllhost.exe (surrogate) can find the AppId registration
    RegSetValueExW(hKey, L"AppId", 0, REG_SZ,
                   (const BYTE *)appIdStr,
                   (DWORD)((wcslen(appIdStr) + 1) * sizeof(WCHAR)));

    // Set InprocServer32
    HKEY hInproc = NULL;
    lr = RegCreateKeyExW(hKey, L"InprocServer32", 0, NULL,
                          REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hInproc, NULL);
    if (lr == ERROR_SUCCESS)
    {
        WCHAR dllPath[MAX_PATH];
        if (GetModuleFileNameW(g_hInst, dllPath, MAX_PATH))
        {
            RegSetValueExW(hInproc, NULL, 0, REG_SZ,
                           (const BYTE *)dllPath,
                           (DWORD)((wcslen(dllPath) + 1) * sizeof(WCHAR)));
        }
        RegSetValueExW(hInproc, L"ThreadingModel", 0, REG_SZ,
                       (const BYTE *)L"Apartment",
                       (DWORD)((wcslen(L"Apartment") + 1) * sizeof(WCHAR)));
        RegCloseKey(hInproc);
    }

    RegCloseKey(hKey);
    CoTaskMemFree(clsidStr);
    CoTaskMemFree(appIdStr);
    return S_OK;
}

static void UnregisterCLSID(REFCLSID clsid)
{
    LPOLESTR clsidStr = NULL;
    if (FAILED(StringFromCLSID(clsid, &clsidStr)))
        return;

    WCHAR keyPath[256];
    if (SUCCEEDED(StringCchPrintfW(keyPath, ARRAYSIZE(keyPath), L"%s%s", CLSID_PREFIX, clsidStr)))
        RegDeleteTreeW(HKEY_CLASSES_ROOT, keyPath);

    CoTaskMemFree(clsidStr);
}

static HRESULT RegisterAppId(void)
{
    LPOLESTR appIdStr = NULL;
    HRESULT hr = StringFromCLSID(&APPID_Arki, &appIdStr);
    if (FAILED(hr)) return hr;

    WCHAR keyPath[256];
    hr = StringCchPrintfW(keyPath, ARRAYSIZE(keyPath), L"AppId\\%s", appIdStr);
    if (FAILED(hr)) { CoTaskMemFree(appIdStr); return hr; }

    HKEY hKey = NULL;
    LRESULT lr = RegCreateKeyExW(HKEY_CLASSES_ROOT, keyPath, 0, NULL,
                                  REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hKey, NULL);
    if (lr == ERROR_SUCCESS)
    {
        // Display name
        LPCWSTR name = L"Arki Shell Extension";
        RegSetValueExW(hKey, NULL, 0, REG_SZ,
                       (const BYTE *)name,
                       (DWORD)((wcslen(name) + 1) * sizeof(WCHAR)));

        // DllSurrogate = "" tells COM to use dllhost.exe as the surrogate
        RegSetValueExW(hKey, L"DllSurrogate", 0, REG_SZ,
                       (const BYTE *)L"",
                       (DWORD)(1 * sizeof(WCHAR)));

        RegCloseKey(hKey);
    }

    CoTaskMemFree(appIdStr);
    return (lr == ERROR_SUCCESS) ? S_OK : E_FAIL;
}

static void UnregisterAppId(void)
{
    LPOLESTR appIdStr = NULL;
    if (FAILED(StringFromCLSID(&APPID_Arki, &appIdStr)))
        return;

    WCHAR keyPath[256];
    if (SUCCEEDED(StringCchPrintfW(keyPath, ARRAYSIZE(keyPath), L"AppId\\%s", appIdStr)))
        RegDeleteTreeW(HKEY_CLASSES_ROOT, keyPath);

    CoTaskMemFree(appIdStr);
}

STDAPI DllRegisterServer(void)
{
    HRESULT hr = RegisterAppId();
    for (int i = 0; i < ARRAYSIZE(g_classes); i++)
    {
        HRESULT r = RegisterCLSID(g_classes[i].clsid, g_classes[i].title);
        if (FAILED(r)) hr = r;
    }
    return hr;
}

STDAPI DllUnregisterServer(void)
{
    for (int i = 0; i < ARRAYSIZE(g_classes); i++)
        UnregisterCLSID(g_classes[i].clsid);
    UnregisterAppId();
    return S_OK;
}

/* ── DllMain ──────────────────────────────────────────────────────────── */

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved)
{
    (void)lpReserved;
    switch (ul_reason_for_call)
    {
    case DLL_PROCESS_ATTACH:
        g_hInst = hModule;
        DisableThreadLibraryCalls(hModule);
        break;
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}
