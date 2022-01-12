// Import dependencies
const ffi = require("ffi-napi");
var ref = require('ref-napi');
var StructType = require('ref-struct-napi')
const { getProxySettings } = require('get-proxy-settings')
const path = require('path');
const { types } = require("ref-napi");
const regedit = require("regedit")
const util = require('util');
const exec = util.promisify(require('child_process').exec);


// Convert JSString to CString
function text(text) {
    return Buffer.from(`${text}\0`, "ucs2");
}

// // Import user32
// const user32 = new ffi.Library("user32", {
//     "MessageBoxW": [
//         "int32", ["int32", "string", "string", "int32"]
//     ],

//     // int MessageBoxW(
//     //     [in, optional] HWND    hWnd,
//     //     [in, optional] LPCWSTR lpText,
//     //     [in, optional] LPCWSTR lpCaption,
//     //     [in]           UINT    uType
//     //   );

//     "SetCursorPos": [
//         "bool", ["int32", "int32"]
//     ]
// });

// // Call the message box function
// const OK_or_Cancel = user32.MessageBoxW(
//     0, text("Hello from Node.js!"), text("Hello, World!"), 1
// );

// // Show the output of the message box
// OK_or_Cancel;

// // Set the cursor position

// user32.SetCursorPos(0, 0);

// typedef struct _WINHTTP_PROXY_INFO {
//     DWORD  dwAccessType;
//     LPWSTR lpszProxy;
//     LPWSTR lpszProxyBypass;
//   } WINHTTP_PROXY_INFO, *LPWINHTTP_PROXY_INFO, *PWINHTTP_PROXY_INFO;

var ProxyInfo = StructType({
    DwAccessType :   "uint32",
	LpszProxy:       "string",
	LpszProxyBypass: "string"
})


var AutoProxyOptions = StructType({
    DwFlags:                "uint32",
    DwAutoDetectFlags:       "uint32",
    LpszAutoConfigUrl:      "string",
    lpvReserved: "uint32",
    dwReserved: "uint32",
    FAutoLogonIfChallenged: "bool",
})

// typedef struct _WINHTTP_AUTOPROXY_OPTIONS {
//     DWORD   dwFlags; <-
//     DWORD   dwAutoDetectFlags;
//     LPCWSTR lpszAutoConfigUrl; <-
//     LPVOID  lpvReserved;
//     DWORD   dwReserved;
//     BOOL    fAutoLogonIfChallenged; <-
//   } WINHTTP_AUTOPROXY_OPTIONS, *PWINHTTP_AUTOPROXY_OPTIONS;

const winHttp = new ffi.Library("winhttp", {
    "WinHttpOpen": [
        //"int32", [ref.refType(ref.types.CString), ref.types.int32, ref.refType(ref.types.int32), ref.refType(ref.types.int32), ref.types.int64]
        "uint32", ["string", "uint32", "string", "string", "uint32"]
    ],

    // WINHTTPAPI HINTERNET WinHttpOpen(
    //     [in, optional] LPCWSTR pszAgentW,
    //     [in]           DWORD   dwAccessType,
    //     [in]           LPCWSTR pszProxyW,
    //     [in]           LPCWSTR pszProxyBypassW,
    //     [in]           DWORD   dwFlags
    //   );

    "WinHttpGetProxyForUrl": [
        "bool", ["uint32", "string", AutoProxyOptions, ProxyInfo]
    ]

    // BOOL WinHttpGetProxyForUrl(
    //     [in]  HINTERNET                 hSession,
    //     [in]  LPCWSTR                   lpcwszUrl,
    //     [in]  WINHTTP_AUTOPROXY_OPTIONS *pAutoProxyOptions,
    //     [out] WINHTTP_PROXY_INFO        *pProxyInfo
    //   );
})

const errhandlingapi = new ffi.Library("Kernel32.dll", {
    "GetLastError": [
        "uint32", []
    ]
})


// const proxyLib = new ffi.Library("proxy.dll", {
//      "Sum": [
//          "int32", ["int32", "int32"]
//      ],
//      "GetProxy": [
//          "string", ["string", "string", ref.types.CString, ref.types.CString]
//      ],
//      "Concat": [
//         ref.types.void, ["string", ref.types.CString]
//      ]
//     })

const WINHTTP_ACCESS_TYPE_DEFAULT_PROXY   = 0
const WINHTTP_ACCESS_TYPE_NO_PROXY        = 1
const WINHTTP_ACCESS_TYPE_NAMED_PROXY     = 3
const WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY = 4


const WINHTTP_AUTOPROXY_CONFIG_URL = 2
const WINHTTP_AUTOPROXY_AUTO_DETECT = 1


const WINHTTP_NO_PROXY_NAME = null
const WINHTTP_NO_PROXY_BYPASS = null

const WINHTTP_AUTO_DETECT_TYPE_DHCP = 1
const WINHTTP_AUTO_DETECT_TYPE_DNS_A = 2


const NO_FLAGS = 0

async function getPacUrlIfExists() {
    try {
        const list = await exec('REG QUERY "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL')
        const stdout = list.stdout.split("\r\n")
        const a = stdout[2].split(" ")
        return a[a.length-1]
    } catch (e) {
        return null
    }
}


async function getProxy(url) { 


    

    const proxy = await getProxySettings()
    if (proxy) {
        //return proxy
        console.log(proxy)
        return
    }
    
    
    try {
                 
        const pacUrl = await getPacUrlIfExists()
        let result
        let hinternet
        let autoProxyOptions
        let pProxyInfo = Buffer.alloc(2000)
        // PAC
        if (pacUrl) {
            console.info('looking for pac', pacUrl)
            hinternet = winHttp.WinHttpOpen(text("ir_agent"), WINHTTP_ACCESS_TYPE_NO_PROXY, "", "", NO_FLAGS)
            autoProxyOptions = new AutoProxyOptions(WINHTTP_AUTOPROXY_CONFIG_URL, 0, text(pacUrl),0,0, true)
            
            result = winHttp.WinHttpGetProxyForUrl(hinternet, text("https://www.google.com"), autoProxyOptions, pProxyInfo)
            console.log(pProxyInfo.toString())
        } else {
        
            // AUTO
            console.log('looking proxi for auto discovery configuration')
            hinternet = winHttp.WinHttpOpen(text("ir_agent"), WINHTTP_ACCESS_TYPE_NO_PROXY, "", "", NO_FLAGS)
            autoProxyOptions = new AutoProxyOptions(WINHTTP_AUTOPROXY_AUTO_DETECT,  WINHTTP_AUTO_DETECT_TYPE_DHCP | WINHTTP_AUTO_DETECT_TYPE_DNS_A, text(""),0,0, true)
            
            result = winHttp.WinHttpGetProxyForUrl(hinternet, text("https://www.google.com"), autoProxyOptions, pProxyInfo)
            console.log(pProxyInfo.toString())
        
        }
        // console.log(`result ${result}`)
        // console.log(JSON.stringify(pProxyInfo))
        // console.log("------------------------------")
        
        // var nameBuffer = Buffer.alloc(1024);

        // proxyLib.Concat("asdsadsadsadasdasd", nameBuffer)
        
        // var port = Buffer.alloc(1024);
        // var host = Buffer.alloc(1024);
        // proxyLib.GetProxy("https", "https://www.google.com", host, port)
        
        // console.log(host.toString())
        // console.log(port.toString())
    
    } catch(e) {
        console.log(e)
    }
}

getProxy('www.google.com').then()